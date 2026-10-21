import { GoogleGenAI } from '@google/genai';

export class AudioTranscriptionError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code = 'AUDIO_TRANSCRIPTION_FAILED',
    ) {
        super(message);
        this.name = 'AudioTranscriptionError';
    }
}

const runtimeEnv = (key: string) => {
    const metaEnv = typeof import.meta !== 'undefined'
        ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
        : undefined;
    return metaEnv?.[key] || process.env[key] || '';
};

const transcribeWithOpenAi = async ({
    file,
    model,
    fetchImpl,
}: {
    file: File;
    model: string;
    fetchImpl: typeof fetch;
}) => {
    const form = new FormData();
    form.append('model', model);
    form.append('file', file, file.name || 'audio.ogg');
    const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${runtimeEnv('OPENAI_API_KEY')}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
    });
    const payload = await response.json().catch(() => ({})) as { text?: string; error?: { message?: string } };
    if (!response.ok) {
        throw new AudioTranscriptionError(
            payload.error?.message || 'Voice note could not be transcribed.',
            response.status || 502,
        );
    }
    return payload.text?.trim() || '';
};

const transcribeWithGoogle = async ({ file, model }: { file: File; model: string }) => {
    const client = new GoogleGenAI({
        apiKey: runtimeEnv('GEMINI_API_KEY') || runtimeEnv('GOOGLE_API_KEY'),
    });
    let uploadedName = '';
    try {
        const uploaded = await client.files.upload({
            file,
            config: {
                displayName: file.name || 'telegram-voice-note.ogg',
                mimeType: file.type || 'audio/ogg',
            },
        });
        uploadedName = uploaded.name || '';
        if (!uploaded.uri) {
            throw new Error('Google did not return an audio file URI.');
        }
        const interaction = await client.interactions.create({
            model,
            input: [{
                type: 'audio',
                uri: uploaded.uri,
                mime_type: (uploaded.mimeType || file.type || 'audio/ogg') as 'audio/ogg',
            }],
            generation_config: {
                transcription_config: { mode: 'smart' },
            },
        });
        return interaction.output_text?.trim() || '';
    } catch (error) {
        if (error instanceof AudioTranscriptionError) throw error;
        throw new AudioTranscriptionError(
            error instanceof Error ? error.message : 'Voice note could not be transcribed.',
            502,
        );
    } finally {
        if (uploadedName) {
            await client.files.delete({ name: uploadedName }).catch(() => undefined);
        }
    }
};

/**
 * Replaceable server-only speech-to-text boundary. Callers own temporary-file
 * retention. OpenAI is preferred when configured; otherwise the project's
 * existing Google AI key is used and its temporary remote upload is deleted.
 */
export const transcribeAudio = async ({
    file,
    model,
    fetchImpl = fetch,
}: {
    file: File;
    model?: string;
    fetchImpl?: typeof fetch;
}) => {
    const requestedProvider = runtimeEnv('AUDIO_TRANSCRIPTION_PROVIDER').trim().toLowerCase();
    const hasOpenAi = Boolean(runtimeEnv('OPENAI_API_KEY'));
    const hasGoogle = Boolean(runtimeEnv('GEMINI_API_KEY') || runtimeEnv('GOOGLE_API_KEY'));
    const provider = requestedProvider || (hasOpenAi ? 'openai' : hasGoogle ? 'google' : '');
    if (!provider || (provider === 'openai' && !hasOpenAi) || (provider === 'google' && !hasGoogle)) {
        throw new AudioTranscriptionError(
            'Voice-note transcription is not configured.',
            503,
            'AUDIO_TRANSCRIPTION_NOT_CONFIGURED',
        );
    }
    if (provider !== 'openai' && provider !== 'google') {
        throw new AudioTranscriptionError(
            `Unsupported audio transcription provider: ${provider}`,
            503,
            'AUDIO_TRANSCRIPTION_NOT_CONFIGURED',
        );
    }

    const selectedModel = provider === 'openai'
        ? model || runtimeEnv('OPENAI_TRANSCRIPTION_MODEL') || 'gpt-4o-mini-transcribe'
        : runtimeEnv('GEMINI_TRANSCRIPTION_MODEL') || 'gemini-3.5-transcribe';
    const text = provider === 'openai'
        ? await transcribeWithOpenAi({ file, model: selectedModel, fetchImpl })
        : await transcribeWithGoogle({ file, model: selectedModel });
    if (!text) throw new AudioTranscriptionError('The voice note did not contain recognisable speech.', 422);
    return { text, model: selectedModel, provider };
};
