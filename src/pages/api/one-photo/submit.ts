import type { APIRoute } from 'astro';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import ffmpegPath from 'ffmpeg-static';

export const prerender = false;

const BUCKET_NAME = 'one-photo-submissions';
const TABLE_NAME = 'bsa_one_photo_submissions';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif']);
const ALLOWED_AUDIO_EXTENSIONS = new Set(['webm', 'mp4', 'm4a', 'mp3', 'wav', 'ogg', 'aac']);
const PLAYBACK_SAFE_AUDIO_MIME = 'audio/mp4';

function normalizeMimeType(mimeType: string): string {
    const normalized = mimeType.toLowerCase().trim().split(';')[0]?.trim() || '';

    if (normalized === 'audio/x-m4a' || normalized === 'audio/m4a' || normalized === 'audio/mp4a-latm') {
        return 'audio/mp4';
    }

    if (normalized === 'audio/x-wav') return 'audio/wav';
    if (normalized === 'audio/mpga') return 'audio/mpeg';
    if (normalized === 'image/jpg') return 'image/jpeg';

    return normalized;
}

function cleanText(value: FormDataEntryValue | null, maxLength = 12000): string {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\r\n/g, '\n').slice(0, maxLength);
}

function toNullableText(value: string): string | null {
    return value ? value : null;
}

function toNumber(value: FormDataEntryValue | null): number | null {
    if (typeof value !== 'string') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100) / 100;
}

function normalizeFileName(fileName: string): string {
    return (fileName || 'upload')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 180) || 'upload';
}

function extensionFromMimeType(mimeType: string, fallback: string): string {
    const normalized = normalizeMimeType(mimeType);

    if (!normalized) return fallback;
    if (normalized.includes('jpeg')) return 'jpg';
    if (normalized.includes('png')) return 'png';
    if (normalized.includes('webp')) return 'webp';
    if (normalized.includes('gif')) return 'gif';
    if (normalized.includes('heic')) return 'heic';
    if (normalized.includes('heif')) return 'heif';
    if (normalized.includes('webm')) return 'webm';
    if (normalized.includes('mp4')) return 'm4a';
    if (normalized.includes('mpeg')) return 'mp3';
    if (normalized.includes('wav')) return 'wav';
    if (normalized.includes('ogg')) return 'ogg';
    if (normalized.includes('aac')) return 'aac';
    return fallback;
}

function extensionFromName(fileName: string): string {
    const parts = normalizeFileName(fileName).split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function replaceExtension(fileName: string, nextExtension: string): string {
    const normalized = normalizeFileName(fileName);
    const withoutExtension = normalized.replace(/\.[^.]+$/, '') || 'one-photo-note';
    return `${withoutExtension}.${nextExtension}`;
}

function isAllowedImage(file: File): boolean {
    const mimeType = normalizeMimeType(file.type);
    if (mimeType.startsWith('image/')) return true;
    return ALLOWED_IMAGE_EXTENSIONS.has(extensionFromName(file.name));
}

function isAllowedAudio(file: File): boolean {
    const mimeType = normalizeMimeType(file.type);
    if (mimeType.startsWith('audio/')) return true;
    return ALLOWED_AUDIO_EXTENSIONS.has(extensionFromName(file.name));
}

function shouldTranscodeAudio(file: File): boolean {
    const mimeType = normalizeMimeType(file.type);
    const extension = extensionFromName(file.name);

    return (
        mimeType.includes('webm') ||
        mimeType.includes('ogg') ||
        extension === 'webm' ||
        extension === 'ogg'
    );
}

function buildStoragePath(folder: 'images' | 'audio', file: File): string {
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const fileName = normalizeFileName(file.name);
    const extension = extensionFromName(fileName) || extensionFromMimeType(file.type, folder === 'images' ? 'jpg' : 'webm');

    return `${folder}/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

async function uploadAsset(
    supabaseAdmin: ReturnType<typeof createClient>,
    file: File,
    folder: 'images' | 'audio',
): Promise<string> {
    const path = buildStoragePath(folder, file);
    const buffer = new Uint8Array(await file.arrayBuffer());
    const contentType = normalizeMimeType(file.type) || undefined;

    const { error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(path, buffer, {
            contentType,
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        throw new Error(error.message);
    }

    return path;
}

async function runFfmpeg(args: string[]): Promise<void> {
    if (!ffmpegPath) {
        throw new Error('FFmpeg is not available for audio transcoding.');
    }

    await new Promise<void>((resolve, reject) => {
        const process = spawn(ffmpegPath, args, {
            stdio: ['ignore', 'ignore', 'pipe'],
        });

        let stderr = '';

        process.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
            if (stderr.length > 6000) {
                stderr = stderr.slice(-6000);
            }
        });

        process.on('error', (error) => {
            reject(error);
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            const detail = stderr.trim();
            reject(
                new Error(
                    detail || `FFmpeg exited with code ${code ?? 'unknown'} while transcoding audio.`,
                ),
            );
        });
    });
}

async function transcodeAudioForPlayback(file: File): Promise<File> {
    const tempDir = await mkdtemp(join(tmpdir(), 'one-photo-audio-'));
    const inputExtension = extensionFromName(file.name) || extensionFromMimeType(file.type, 'webm');
    const inputPath = join(tempDir, `input.${inputExtension}`);
    const outputPath = join(tempDir, 'output.m4a');

    try {
        await writeFile(inputPath, new Uint8Array(await file.arrayBuffer()));

        await runFfmpeg([
            '-y',
            '-i',
            inputPath,
            '-vn',
            '-ac',
            '1',
            '-ar',
            '44100',
            '-c:a',
            'aac',
            '-b:a',
            '96k',
            '-movflags',
            '+faststart',
            outputPath,
        ]);

        const outputBuffer = await readFile(outputPath);

        if (!outputBuffer.byteLength) {
            throw new Error('Audio transcoding produced an empty file.');
        }

        return new File([outputBuffer], replaceExtension(file.name, 'm4a'), {
            type: PLAYBACK_SAFE_AUDIO_MIME,
        });
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

export const POST: APIRoute = async ({ request }) => {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
            JSON.stringify({ error: 'Supabase server credentials are missing.' }),
            { status: 500 },
        );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const uploadedPaths: string[] = [];

    try {
        const formData = await request.formData();
        const honeypot = cleanText(formData.get('website'), 200);
        if (honeypot) {
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const story = cleanText(formData.get('story'));
        const sourceContext = cleanText(formData.get('source_context'), 120) || 'bsa-2026-poster';
        const image = formData.get('image');
        const audio = formData.get('audio');
        const audioDurationSeconds = toNumber(formData.get('audio_duration_seconds'));
        const audioMime = normalizeMimeType(cleanText(formData.get('audio_mime'), 120));

        const imageFile = image instanceof File && image.size > 0 ? image : null;
        const audioFile = audio instanceof File && audio.size > 0 ? audio : null;
        const originalAudioMime = audioMime || normalizeMimeType(audioFile?.type || '') || null;
        const originalAudioFileName = audioFile ? normalizeFileName(audioFile.name) : null;
        let preparedAudioFile = audioFile;
        let audioWasTranscoded = false;

        if (!story && !imageFile && !audioFile) {
            return new Response(
                JSON.stringify({ error: 'Please provide at least one of image, text, or audio.' }),
                { status: 400 },
            );
        }

        if (imageFile) {
            if (!isAllowedImage(imageFile)) {
                return new Response(JSON.stringify({ error: 'Unsupported image format.' }), { status: 400 });
            }

            if (imageFile.size > MAX_IMAGE_BYTES) {
                return new Response(JSON.stringify({ error: 'Image file is too large.' }), { status: 400 });
            }
        }

        if (audioFile) {
            if (!isAllowedAudio(audioFile)) {
                return new Response(JSON.stringify({ error: 'Unsupported audio format.' }), { status: 400 });
            }

            if (audioFile.size > MAX_AUDIO_BYTES) {
                return new Response(JSON.stringify({ error: 'Audio file is too large.' }), { status: 400 });
            }

            if (shouldTranscodeAudio(audioFile)) {
                try {
                    preparedAudioFile = await transcodeAudioForPlayback(audioFile);
                    audioWasTranscoded = true;
                } catch (error) {
                    console.error('Failed to transcode one-photo audio upload:', error);
                    return new Response(
                        JSON.stringify({
                            error: 'We could not prepare this audio for reliable phone playback. Please try recording again.',
                        }),
                        { status: 500 },
                    );
                }
            }

            if (preparedAudioFile.size > MAX_AUDIO_BYTES) {
                return new Response(
                    JSON.stringify({ error: 'Audio file is too large after processing.' }),
                    { status: 400 },
                );
            }
        }

        let imagePath: string | null = null;
        let audioPath: string | null = null;

        if (imageFile) {
            imagePath = await uploadAsset(supabaseAdmin, imageFile, 'images');
            uploadedPaths.push(imagePath);
        }

        if (preparedAudioFile) {
            audioPath = await uploadAsset(supabaseAdmin, preparedAudioFile, 'audio');
            uploadedPaths.push(audioPath);
        }

        const { data, error } = await supabaseAdmin
            .from(TABLE_NAME)
            .insert({
                project_slug: 'one-photo',
                source_context: sourceContext,
                response_text: toNullableText(story),
                image_path: imagePath,
                image_file_name: imageFile ? normalizeFileName(imageFile.name) : null,
                image_mime: normalizeMimeType(imageFile?.type || '') || null,
                image_size_bytes: imageFile?.size || null,
                audio_path: audioPath,
                audio_file_name: preparedAudioFile ? normalizeFileName(preparedAudioFile.name) : null,
                audio_mime: preparedAudioFile
                    ? normalizeMimeType(preparedAudioFile.type) || originalAudioMime
                    : null,
                audio_size_bytes: preparedAudioFile?.size || null,
                audio_duration_seconds: audioDurationSeconds,
                metadata: {
                    form_version: 'one-photo-v2',
                    referer: request.headers.get('referer'),
                    user_agent: request.headers.get('user-agent'),
                    ...(audioWasTranscoded
                        ? {
                            audio_transcoded_for_playback: true,
                            audio_original_file_name: originalAudioFileName,
                            audio_original_mime: originalAudioMime,
                        }
                        : {}),
                },
            })
            .select('id, created_at')
            .single();

        if (error) {
            throw new Error(error.message);
        }

        return new Response(JSON.stringify({
            ok: true,
            id: data.id,
            created_at: data.created_at,
        }), { status: 200 });
    } catch (error) {
        if (uploadedPaths.length) {
            try {
                await supabaseAdmin.storage.from(BUCKET_NAME).remove(uploadedPaths);
            } catch (_cleanupError) {
                // Best effort cleanup for partially uploaded assets.
            }
        }

        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Something went wrong while saving the response.',
            }),
            { status: 500 },
        );
    }
};
