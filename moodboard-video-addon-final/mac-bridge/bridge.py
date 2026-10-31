#!/usr/bin/env python3
"""Local, paired Pinterest video → full-length GIF bridge for Abodid Moodboard.

Only binds to 127.0.0.1. Requires a random per-install pairing key for every
request. It is deliberately independent of the existing image extension/API.
"""
from __future__ import annotations

import hmac
import json
import re
import secrets
import shutil
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

PORT = 39761
MAX_OUTPUT_BYTES = 19_000_000  # decimal bytes: strictly under 20 MB, with margin
MAX_FRAMES_AREA = 49_000_000  # Images binding must actually transform animation
MAX_INPUT_BYTES = 250 * 1024 * 1024
MAX_DURATION = 300.0
POLL_TTL_SECONDS = 3 * 3600
APP_DIR = Path.home() / 'Library' / 'Application Support' / 'Abodid Moodboard Video'
KEY_PATH = APP_DIR / 'pairing-key'
TMP_ROOT = APP_DIR / 'jobs'
PINTEREST_HOST = re.compile(r'^(?:(?:[a-z0-9-]+)\.)?pinterest\.(?:com|co\.uk|co\.in|ca)$', re.I)
PIN_PATH = re.compile(r'^/pin/(?:[\w-]+--)?(\d+)/?$', re.I)
# Width, sampled FPS (discarding frames evenly), and palette colours.
# Highest-quality viable preset wins; every preset preserves the whole timeline.
PRESETS = [
    (480, 12, 128), (480, 10, 96), (400, 10, 96), (400, 8, 80),
    (360, 8, 64), (320, 8, 64), (320, 6, 48), (280, 6, 48),
    (240, 5, 40), (200, 4, 32), (160, 3, 24),
]


def canonical_pinterest_url(value: str) -> tuple[str, str]:
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError('Invalid Pinterest Pin URL.')
    parsed = urlparse(value.strip())
    if parsed.scheme != 'https' or not parsed.hostname or not PINTEREST_HOST.fullmatch(parsed.hostname):
        raise ValueError('Only public HTTPS Pinterest Pin URLs are supported.')
    if parsed.username or parsed.password or parsed.port:
        raise ValueError('Invalid Pinterest Pin URL credentials/port.')
    match = PIN_PATH.fullmatch(parsed.path)
    if not match:
        raise ValueError('Open the individual video Pin; boards and feeds are not valid extraction URLs.')
    # Preserve the real Pin hostname under the pointer (e.g. in.pinterest.com),
    # while stripping tracking parameters and unrelated page fragments.
    return match.group(1), f'https://{parsed.hostname.lower()}/pin/{match.group(1)}/'


def require_binary(name: str) -> str:
    location = shutil.which(name)
    if not location:
        raise RuntimeError(f'{name} not found on your Mac. Install it with Homebrew and restart the video bridge.')
    return location


def run(args: list[str], timeout: int, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                              timeout=timeout, check=True, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f'{Path(args[0]).name} exceeded its time limit.') from None
    except subprocess.CalledProcessError as exc:
        details = (exc.stderr or exc.stdout or '').strip()[-850:]
        raise RuntimeError(f'{Path(args[0]).name} failed: {details or exc.returncode}') from None


def video_metadata(path: Path) -> tuple[int, int, float]:
    result = run([require_binary('ffprobe'), '-v', 'error', '-select_streams', 'v:0',
                  '-show_entries', 'stream=width,height,duration:format=duration',
                  '-of', 'json', str(path)], timeout=20)
    data = json.loads(result.stdout)
    stream = (data.get('streams') or [{}])[0]
    width, height = int(stream.get('width') or 0), int(stream.get('height') or 0)
    duration = float((data.get('format') or {}).get('duration') or stream.get('duration') or 0)
    if width < 16 or height < 16 or not (0 < duration <= MAX_DURATION):
        raise RuntimeError(f'Video metadata outside supported bounds (max {int(MAX_DURATION)} seconds).')
    return width, height, duration


def gif_info(path: Path) -> tuple[int, int, int, float]:
    with path.open('rb') as f:
        signature = f.read(6)
    if path.stat().st_size < 50 or signature not in (b'GIF89a', b'GIF87a'):
        raise RuntimeError('FFmpeg did not produce a valid GIF.')
    result = run([require_binary('ffprobe'), '-v', 'error', '-count_frames', '-select_streams', 'v:0',
                  '-show_entries', 'stream=width,height,nb_read_frames:format=duration', '-of', 'json', str(path)], timeout=30)
    gif_data = json.loads(result.stdout)
    stream = (gif_data.get('streams') or [{}])[0]
    gif_duration = float((gif_data.get('format') or {}).get('duration') or 0)
    return int(stream.get('width') or 0), int(stream.get('height') or 0), int(stream.get('nb_read_frames') or 0), gif_duration


def convert_video_to_gif(source: Path, folder: Path, on_progress=None) -> tuple[Path, dict]:
    width, height, duration = video_metadata(source)
    last_note = 'No preset produced a GIF within processing limits.'
    for i, (max_width, fps, colors) in enumerate(PRESETS):
        if on_progress:
            on_progress(i + 1, len(PRESETS), max_width, fps, colors)
        target_width = min(width, max_width)
        target_width -= target_width % 2
        target_height = max(2, round(height * target_width / width / 2) * 2)
        estimated_area = target_width * target_height * (int(duration * fps) + 2)
        if estimated_area > MAX_FRAMES_AREA:
            last_note = f'Animation exceeds frame-area budget at {target_width}px/{fps}fps.'
            continue
        output = folder / f'animated-{i}.gif'
        filters = (
            f'[0:v]fps={fps},scale={target_width}:{target_height}:flags=lanczos,split[a][b];'
            f'[a]palettegen=max_colors={colors}:stats_mode=diff[p];'
            '[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle[v]'
        )
        run([require_binary('ffmpeg'), '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
             '-i', str(source), '-filter_complex', filters,
             '-map', '[v]', '-an', '-loop', '0', str(output)], timeout=180)
        file_size = output.stat().st_size
        if file_size > MAX_OUTPUT_BYTES:
            last_note = f'GIF {file_size / 1024 / 1024:.1f} MiB was too large at {target_width}px/{fps}fps.'
            output.unlink(missing_ok=True)
            continue
        gif_width, gif_height, frame_count, gif_duration = gif_info(output)
        frame_area = gif_width * gif_height * frame_count
        if frame_count <= 1 or frame_area > MAX_FRAMES_AREA:
            last_note = 'GIF animation was not preserved or exceeds frame-area limit.'
            output.unlink(missing_ok=True)
            continue
        # The filter consumes all frames from the full video. A conservative count
        # check catches accidental shortened output, while tolerating frame rounding.
        expected = duration * fps
        if frame_count < max(2, int(expected * .90)):
            last_note = f'GIF appeared truncated ({frame_count} frames vs {expected:.0f} expected).'
            output.unlink(missing_ok=True)
            continue
        if gif_duration <= 0 or abs(gif_duration - duration) > max(0.50, duration * 0.06):
            last_note = f'GIF timeline differs from source: {gif_duration:.2f}s vs {duration:.2f}s.'
            output.unlink(missing_ok=True)
            continue
        # FFmpeg -loop 0 writes a Netscape application extension with loop-count zero.
        # Don't silently accept a one-shot animation.
        if b'NETSCAPE2.0' not in output.read_bytes()[:5000] or b'NETSCAPE2.0\x03\x01\x00\x00' not in output.read_bytes()[:5000]:
            last_note = 'GIF is missing infinite-loop metadata.'
            output.unlink(missing_ok=True)
            continue
        return output, {'sourceSeconds': duration, 'gifSeconds': gif_duration, 'loop': 0, 'fps': fps,
                        'paletteColors': colors,
                        'width': gif_width, 'height': gif_height,
                        'frames': frame_count, 'sizeBytes': file_size}
    raise RuntimeError('Could not convert the complete video to a GIF under 19 MiB and Cloudflare limits. ' + last_note)


@dataclass
class Job:
    id: str
    pin_id: str
    url: str
    folder: Path
    status: str = 'queued'
    error: str = ''
    gif_path: Path | None = None
    details: dict = field(default_factory=dict)
    title: str = ''
    original_filename: str = ''
    created: float = field(default_factory=time.time)
    updated: float = field(default_factory=time.time)
    message: str = 'Waiting for the Mac converter'
    attempt: int = 0
    total_attempts: int = len(PRESETS)
    preset: dict = field(default_factory=dict)


jobs: dict[str, Job] = {}
lock = threading.RLock()
executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix='moodboard-video')


def best_source_title(data: dict, pin_id: str) -> str:
    # Pinterest/yt-dlp sometimes has no title; never invent an artist credit.
    for field in ('title', 'fulltitle', 'alt_title'):
        value = data.get(field)
        if isinstance(value, str) and value.strip() and value.strip().lower() not in ('na', 'none'):
            return re.sub(r'\s+', ' ', value).strip()[:190]
    return f'Pinterest video {pin_id}'


def presentation_filename(title: str, pin_id: str) -> str:
    # Keep human-readable Pinterest title and the stable Pin ID, but avoid path traversal.
    stem = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', '-', title)
    stem = re.sub(r'\s+', ' ', stem).strip(' .-_')[:135]
    return f'{stem or "Pinterest video"} - {pin_id}.gif'


def process(job: Job) -> None:
    try:
        job.status = 'downloading'
        job.message = 'Downloading the full Pinterest video'
        job.updated = time.time()
        output_pattern = job.folder / 'source.%(ext)s'
        result = run([require_binary('yt-dlp'), '--no-playlist', '--no-warnings', '--no-progress',
                      '--no-simulate', '--max-filesize', '250M', '--socket-timeout', '20', '--retries', '2',
                      '-f', 'bv*+ba/b', '--merge-output-format', 'mp4',
                      '--write-info-json', '--no-write-thumbnail',
                      '-o', str(output_pattern), '--print', 'after_move:filepath',
                      '--', job.url], timeout=240)
        candidates = [Path(line.strip()) for line in result.stdout.splitlines() if line.strip()]
        videos = [path for path in candidates if path.is_file() and path.parent == job.folder]
        if not videos:
            videos = [p for p in job.folder.glob('source.*') if p.is_file()]
        if len(videos) != 1:
            raise RuntimeError('Pinterest did not return exactly one downloadable video.')
        source = videos[0]
        if source.stat().st_size <= 0 or source.stat().st_size > MAX_INPUT_BYTES:
            raise RuntimeError('Downloaded video exceeds the 250 MiB local safety limit.')
        infos = list(job.folder.glob('*.info.json'))
        metadata = {}
        if infos:
            try:
                metadata = json.loads(infos[0].read_text(encoding='utf-8'))
            except (ValueError, OSError):
                pass
        title = best_source_title(metadata, job.pin_id)
        job.title = title
        job.original_filename = presentation_filename(title, job.pin_id)
        job.status = 'converting'
        job.message = 'Optimizing GIF without trimming the timeline'
        job.updated = time.time()

        def conversion_attempt(number, total, max_width, fps, colors):
            job.attempt = number
            job.total_attempts = total
            job.preset = {'maxWidth': max_width, 'fps': fps, 'colors': colors}
            job.message = f'Compression attempt {number} of {total}: {max_width}px · {fps} fps · {colors} colours'
            job.updated = time.time()

        gif, details = convert_video_to_gif(source, job.folder, conversion_attempt)
        job.gif_path = gif
        job.details = {**details, 'title': job.title,
                       'filename': job.original_filename, 'sourceUrl': job.url,
                       'pinId': job.pin_id}
        source.unlink(missing_ok=True)
        job.status = 'done'
        job.message = 'GIF ready; waiting for the Chrome extension to upload'
        job.updated = time.time()
    except Exception as exc:
        job.error = str(exc)[:1000]
        job.status = 'failed'
        job.message = 'Conversion failed'
        job.updated = time.time()
        shutil.rmtree(job.folder, ignore_errors=True)


def response(handler: BaseHTTPRequestHandler, code: int, data: dict) -> None:
    payload = json.dumps(data).encode('utf-8')
    handler.send_response(code)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(payload)))
    handler.send_header('Cache-Control', 'no-store')
    handler.send_header('X-Content-Type-Options', 'nosniff')
    handler.end_headers()
    handler.wfile.write(payload)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        print('[bridge]', fmt % args, flush=True)

    def authorized(self) -> bool:
        origin = self.headers.get('Origin', '')
        if origin and not origin.startswith('chrome-extension://'):
            return False
        return hmac.compare_digest(self.headers.get('X-Moodboard-Local-Key', ''), PAIRING_KEY)

    def do_GET(self) -> None:
        if not self.authorized():
            return response(self, 401, {'error': 'Local bridge pairing key missing or invalid.'})
        if self.path == '/health':
            return response(self, 200, {'ok': True, 'service': 'moodboard-video-bridge', 'version': 1})
        match = re.fullmatch(r'/jobs/([0-9a-f]{32})(/file)?', self.path)
        if not match:
            return response(self, 404, {'error': 'Unknown endpoint.'})
        with lock:
            job = jobs.get(match.group(1))
        if not job:
            return response(self, 404, {'error': 'Job was not found; the bridge may have restarted.'})
        if match.group(2) == '/file':
            if job.status != 'done' or not job.gif_path or not job.gif_path.is_file():
                return response(self, 409, {'error': 'GIF is not ready.'})
            self.send_response(200)
            self.send_header('Content-Type', 'image/gif')
            self.send_header('Content-Length', str(job.gif_path.stat().st_size))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            with job.gif_path.open('rb') as f:
                shutil.copyfileobj(f, self.wfile)
            return
        return response(self, 200, {
            'status': job.status, 'error': job.error, 'message': job.message,
            'attempt': job.attempt, 'totalAttempts': job.total_attempts,
            'preset': job.preset, 'createdAt': job.created,
            'updatedAt': job.updated, **job.details})

    def do_POST(self) -> None:
        if not self.authorized():
            return response(self, 401, {'error': 'Local bridge pairing key missing or invalid.'})
        if re.fullmatch(r'/jobs/[0-9a-f]{32}/finish', self.path):
            job_id = self.path.split('/')[2]
            with lock:
                job = jobs.get(job_id)
                if job and job.status == 'done':
                    jobs.pop(job_id, None)
            if job and job.status == 'done':
                shutil.rmtree(job.folder, ignore_errors=True)
            return response(self, 200, {'ok': True})
        if self.path != '/jobs':
            return response(self, 404, {'error': 'Unknown endpoint.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 4096:
                raise ValueError('Invalid request length.')
            body = json.loads(self.rfile.read(length))
            pin_id, canonical = canonical_pinterest_url(body.get('sourceUrl', ''))
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            return response(self, 400, {'error': str(exc) or 'Invalid request.'})
        with lock:
            # Reuse a queued/done job for the same Pin to prevent accidental double-click.
            existing = next((j for j in jobs.values() if j.pin_id == pin_id and j.status != 'failed'), None)
            if existing:
                return response(self, 200, {'jobId': existing.id, 'status': existing.status})
            if len([j for j in jobs.values() if j.status in ('queued','downloading','converting')]) >= 5:
                return response(self, 429, {'error': 'Video converter is busy. Retry later.'})
            job_id = secrets.token_hex(16)
            folder = TMP_ROOT / job_id
            folder.mkdir(mode=0o700, parents=True, exist_ok=False)
            job = Job(job_id, pin_id, canonical, folder)
            jobs[job_id] = job
            executor.submit(process, job)
        return response(self, 202, {'jobId': job.id, 'status': job.status})


def maintenance() -> None:
    while True:
        time.sleep(600)
        cutoff = time.time() - POLL_TTL_SECONDS
        with lock:
            old = [id for id, job in jobs.items() if job.created < cutoff and job.status in ('done','failed')]
            for id in old:
                job = jobs.pop(id)
                shutil.rmtree(job.folder, ignore_errors=True)


def init() -> None:
    APP_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    TMP_ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not KEY_PATH.exists():
        KEY_PATH.write_text(secrets.token_urlsafe(36) + '\n')
        KEY_PATH.chmod(0o600)
    for binary in ('yt-dlp', 'ffmpeg', 'ffprobe'):
        print(f'{binary}: {require_binary(binary)}', flush=True)


if __name__ == '__main__':
    init()
    PAIRING_KEY = KEY_PATH.read_text().strip()
    threading.Thread(target=maintenance, daemon=True).start()
    httpd = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print(f'Moodboard video bridge listening only on http://127.0.0.1:{PORT}', flush=True)
    httpd.serve_forever(poll_interval=0.5)
