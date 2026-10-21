export const prerender = false;

import type { APIRoute } from 'astro';
import { AudioTranscriptionError, transcribeAudio } from '../../lib/audio/transcribeAudio';

export const POST: APIRoute = async ({ request }) => {
    try {
        const form = await request.formData();
        const file = form.get('file');
        const mode = (form.get('mode') || 'free').toString();

        if (!file || typeof file === 'string') {
            return new Response(JSON.stringify({ error: 'Audio file is required' }), { status: 400 });
        }

        const result = await transcribeAudio({
            file: file as File,
            model: mode === 'paid' ? 'gpt-4o-mini-transcribe' : 'whisper-1',
        });
        return new Response(JSON.stringify({ text: result.text }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Internal Server Error'
        }), { status: error instanceof AudioTranscriptionError ? error.status : 500 });
    }
};
