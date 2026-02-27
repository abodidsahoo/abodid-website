import type { APIRoute } from 'astro';

const OPENAI_API_KEY = import.meta.env.OPENAI_API_KEY;

export const POST: APIRoute = async ({ request }) => {
    try {
        if (!OPENAI_API_KEY) {
            return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), { status: 500 });
        }

        const form = await request.formData();
        const file = form.get('file');
        const mode = (form.get('mode') || 'free').toString();

        if (!file || typeof file === 'string') {
            return new Response(JSON.stringify({ error: 'Audio file is required' }), { status: 400 });
        }

        const model = mode === 'paid' ? 'gpt-4o-mini-transcribe' : 'whisper-1';

        const forward = new FormData();
        forward.append('model', model);
        forward.append('file', file, (file as File).name || 'audio.webm');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: forward
        });

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({ error: errorText || 'Transcription failed' }), { status: response.status });
        }

        const data = await response.json();
        return new Response(JSON.stringify({ text: data.text || '' }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Internal Server Error'
        }), { status: 500 });
    }
};
