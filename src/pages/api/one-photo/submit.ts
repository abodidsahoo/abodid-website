import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const BUCKET_NAME = 'one-photo-submissions';
const TABLE_NAME = 'bsa_one_photo_submissions';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif']);
const ALLOWED_AUDIO_EXTENSIONS = new Set(['webm', 'mp4', 'm4a', 'mp3', 'wav', 'ogg', 'aac']);

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
    if (!mimeType) return fallback;
    if (mimeType.includes('jpeg')) return 'jpg';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('gif')) return 'gif';
    if (mimeType.includes('heic')) return 'heic';
    if (mimeType.includes('heif')) return 'heif';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('mp4')) return 'm4a';
    if (mimeType.includes('mpeg')) return 'mp3';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('aac')) return 'aac';
    return fallback;
}

function extensionFromName(fileName: string): string {
    const parts = normalizeFileName(fileName).split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function isAllowedImage(file: File): boolean {
    if (file.type.startsWith('image/')) return true;
    return ALLOWED_IMAGE_EXTENSIONS.has(extensionFromName(file.name));
}

function isAllowedAudio(file: File): boolean {
    if (file.type.startsWith('audio/')) return true;
    return ALLOWED_AUDIO_EXTENSIONS.has(extensionFromName(file.name));
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

    const { error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(path, buffer, {
            contentType: file.type || undefined,
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        throw new Error(error.message);
    }

    return path;
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
        const audioMime = cleanText(formData.get('audio_mime'), 120);

        const imageFile = image instanceof File && image.size > 0 ? image : null;
        const audioFile = audio instanceof File && audio.size > 0 ? audio : null;

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
        }

        let imagePath: string | null = null;
        let audioPath: string | null = null;

        if (imageFile) {
            imagePath = await uploadAsset(supabaseAdmin, imageFile, 'images');
            uploadedPaths.push(imagePath);
        }

        if (audioFile) {
            audioPath = await uploadAsset(supabaseAdmin, audioFile, 'audio');
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
                image_mime: imageFile?.type || null,
                image_size_bytes: imageFile?.size || null,
                audio_path: audioPath,
                audio_file_name: audioFile ? normalizeFileName(audioFile.name) : null,
                audio_mime: audioMime || audioFile?.type || null,
                audio_size_bytes: audioFile?.size || null,
                audio_duration_seconds: audioDurationSeconds,
                metadata: {
                    form_version: 'one-photo-v1',
                    referer: request.headers.get('referer'),
                    user_agent: request.headers.get('user-agent'),
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
