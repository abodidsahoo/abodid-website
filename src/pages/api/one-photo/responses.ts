import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const BUCKET_NAME = 'one-photo-submissions';
const TABLE_NAME = 'bsa_one_photo_submissions';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const MAX_RESPONSES = 180;

type ResponseRow = {
    id: string;
    created_at: string;
    response_text: string | null;
    image_path: string | null;
    audio_path: string | null;
    audio_duration_seconds: number | null;
    submission_status: string;
};

async function createSignedUrlOrNull(
    supabaseAdmin: ReturnType<typeof createClient>,
    path: string | null,
): Promise<string | null> {
    if (!path) return null;

    const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error) {
        console.error('Failed to create signed URL for one-photo response asset:', error);
        return null;
    }

    return data.signedUrl || null;
}

export const GET: APIRoute = async () => {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
            JSON.stringify({ error: 'Supabase server credentials are missing.' }),
            { status: 500 },
        );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    try {
        const { data, error } = await supabaseAdmin
            .from(TABLE_NAME)
            .select('id, created_at, response_text, image_path, audio_path, audio_duration_seconds, submission_status')
            .in('submission_status', ['received', 'reviewed'])
            .order('created_at', { ascending: false })
            .limit(MAX_RESPONSES);

        if (error) {
            throw new Error(error.message);
        }

        const rows = ((data || []) as ResponseRow[]).filter((row) => {
            return Boolean(
                (row.response_text && row.response_text.trim()) ||
                row.image_path ||
                row.audio_path,
            );
        });

        const responses = await Promise.all(
            rows.map(async (row) => {
                const [imageUrl, audioUrl] = await Promise.all([
                    createSignedUrlOrNull(supabaseAdmin, row.image_path),
                    createSignedUrlOrNull(supabaseAdmin, row.audio_path),
                ]);

                return {
                    id: row.id,
                    createdAt: row.created_at,
                    responseText: row.response_text?.trim() || '',
                    imageUrl,
                    audioUrl,
                    audioDurationSeconds: row.audio_duration_seconds || null,
                };
            }),
        );

        return new Response(JSON.stringify({ responses }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
            },
        });
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Could not load responses.',
            }),
            { status: 500 },
        );
    }
};
