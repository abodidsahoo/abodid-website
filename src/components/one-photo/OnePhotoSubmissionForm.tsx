import React, { useEffect, useRef, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    ImagePlus,
    Mail,
    Mic,
    Square,
    UploadCloud,
} from 'lucide-react';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif']);
const RECORDING_MIME_CANDIDATES = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav',
];

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

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function extensionForAudioMime(mimeType: string): string {
    const normalized = normalizeMimeType(mimeType);

    if (normalized.includes('mp4')) return 'm4a';
    if (normalized.includes('mpeg')) return 'mp3';
    if (normalized.includes('ogg')) return 'ogg';
    if (normalized.includes('wav')) return 'wav';
    return 'webm';
}

function getFileExtension(fileName: string): string {
    const parts = fileName.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
}

function getPreferredRecordingMimeType(): string {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return '';
    }

    return (
        RECORDING_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || ''
    );
}

export default function OnePhotoSubmissionForm() {
    const [story, setStory] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
    const [audioMimeType, setAudioMimeType] = useState('');
    const [audioDurationSeconds, setAudioDurationSeconds] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [recorderMessage, setRecorderMessage] = useState<string | null>(null);
    const [submissionId, setSubmissionId] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!imageFile) {
            setImagePreviewUrl('');
            return;
        }

        const nextUrl = URL.createObjectURL(imageFile);
        setImagePreviewUrl(nextUrl);

        return () => {
            URL.revokeObjectURL(nextUrl);
        };
    }, [imageFile]);

    useEffect(() => {
        if (!audioBlob) {
            setAudioPreviewUrl('');
            return;
        }

        const nextUrl = URL.createObjectURL(audioBlob);
        setAudioPreviewUrl(nextUrl);

        return () => {
            URL.revokeObjectURL(nextUrl);
        };
    }, [audioBlob]);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
            }

            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }

            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    const stopTimer = () => {
        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const stopStream = () => {
        if (!mediaStreamRef.current) return;
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
    };

    const resetAudio = () => {
        stopTimer();
        stopStream();
        setIsRecording(false);
        setElapsedSeconds(0);
        setAudioBlob(null);
        setAudioPreviewUrl('');
        setAudioDurationSeconds(0);
        setAudioMimeType('');
        setRecorderMessage(null);
        chunksRef.current = [];
        mediaRecorderRef.current = null;
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMessage(null);
        const file = event.target.files?.[0];

        if (!file) {
            setImageFile(null);
            return;
        }

        if (!file.type.startsWith('image/') && !ALLOWED_IMAGE_EXTENSIONS.has(getFileExtension(file.name))) {
            setErrorMessage('Please upload a valid image file.');
            event.target.value = '';
            return;
        }

        if (file.size > MAX_IMAGE_BYTES) {
            setErrorMessage(`Please keep the image under ${formatBytes(MAX_IMAGE_BYTES)}.`);
            event.target.value = '';
            return;
        }

        setImageFile(file);
    };

    const openImagePicker = () => {
        imageInputRef.current?.click();
    };

    const startRecording = async () => {
        setErrorMessage(null);
        setRecorderMessage(null);

        if (
            typeof window === 'undefined' ||
            !navigator.mediaDevices?.getUserMedia ||
            typeof MediaRecorder === 'undefined'
        ) {
            setRecorderMessage(
                'Audio recording is not supported on this browser. You can still share text or an image.',
            );
            return;
        }

        try {
            resetAudio();

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const preferredMimeType = getPreferredRecordingMimeType();

            const recorder = preferredMimeType
                ? new MediaRecorder(stream, { mimeType: preferredMimeType })
                : new MediaRecorder(stream);

            const startedAt = Date.now();
            chunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const resolvedMimeType = normalizeMimeType(
                    recorder.mimeType || preferredMimeType || chunksRef.current[0]?.type || 'audio/webm',
                );
                const blob = new Blob(chunksRef.current, {
                    type: resolvedMimeType,
                });
                const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

                if (blob.size > MAX_AUDIO_BYTES) {
                    setRecorderMessage(
                        `That recording is larger than ${formatBytes(MAX_AUDIO_BYTES)}. Please try a shorter note.`,
                    );
                    setAudioBlob(null);
                    setAudioDurationSeconds(0);
                    setAudioMimeType('');
                } else {
                    setAudioBlob(blob);
                    setAudioDurationSeconds(duration);
                    setAudioMimeType(resolvedMimeType);
                }

                setIsRecording(false);
                setElapsedSeconds(0);
                stopTimer();
                stopStream();
                chunksRef.current = [];
            };

            recorder.onerror = () => {
                setRecorderMessage('The microphone stopped unexpectedly. Please try recording again.');
                setIsRecording(false);
                setElapsedSeconds(0);
                stopTimer();
                stopStream();
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            setAudioBlob(null);
            setAudioPreviewUrl('');
            setAudioDurationSeconds(0);
            setAudioMimeType(
                normalizeMimeType(recorder.mimeType || preferredMimeType || 'audio/webm'),
            );
            setElapsedSeconds(0);
            setIsRecording(true);

            timerRef.current = window.setInterval(() => {
                setElapsedSeconds((current) => current + 1);
            }, 1000);
        } catch (error) {
            stopTimer();
            stopStream();
            setIsRecording(false);
            setRecorderMessage(
                error instanceof Error
                    ? `Could not access the microphone: ${error.message}`
                    : 'Could not access the microphone.',
            );
        }
    };

    const stopRecording = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            return;
        }

        mediaRecorderRef.current.stop();
        setIsRecording(false);
        stopTimer();
    };

    const clearImage = () => {
        setImageFile(null);
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
        setErrorMessage(null);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage(null);

        if (isRecording) {
            setErrorMessage('Please stop the recording before submitting.');
            return;
        }

        const trimmedStory = story.trim();
        if (!trimmedStory && !imageFile && !audioBlob) {
            setErrorMessage('Please share at least one thing: a story, an audio note, or one image.');
            return;
        }

        try {
            setIsSubmitting(true);
            const formData = new FormData(event.currentTarget);
            formData.set('story', trimmedStory);
            formData.append('source_context', 'bsa-2026-poster');

            if (imageFile) {
                formData.append('image', imageFile);
            }

            if (audioBlob) {
                const mimeType = normalizeMimeType(audioMimeType || audioBlob.type || 'audio/webm');
                const extension = extensionForAudioMime(mimeType);
                formData.append('audio', audioBlob, `one-photo-note.${extension}`);
                formData.append('audio_duration_seconds', audioDurationSeconds.toString());
                formData.append('audio_mime', mimeType);
            }

            const response = await fetch('/api/one-photo/submit', {
                method: 'POST',
                body: formData,
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload.error || 'Something went wrong while saving your response.');
            }

            setSubmissionId(payload.id || 'shared');
            setStory('');
            setImageFile(null);
            resetAudio();
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while saving your response.',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submissionId) {
        return (
            <div className="one-photo-success">
                <div className="one-photo-status one-photo-status--success">
                    <CheckCircle2 size={16} />
                    <span>Response saved</span>
                </div>
                <h2>
                    Thank you for sharing the story behind the photograph which stays with you
                    amongst thousands of images.
                </h2>
                <div className="rw-button-row one-photo-actions">
                    <a className="rw-button rw-button--primary" href="/one-photo/responses">
                        See all responses
                    </a>
                    <a
                        className="rw-button rw-button--secondary"
                        href="/research/invisible-punctum"
                    >
                        Read more about the project
                    </a>
                </div>
                <div className="one-photo-followup" role="status" aria-live="polite">
                    <div className="one-photo-followup__icon" aria-hidden="true">
                        <Mail size={15} />
                    </div>
                    <div className="one-photo-followup__body">
                        <p>
                            Want to stay updated? I share one short monthly newsletter with
                            research notes and useful creative resources.
                        </p>
                        <a className="one-photo-followup__link" href="/newsletter">
                            Subscribe to the newsletter
                        </a>
                    </div>
                </div>
                <p className="one-photo-reference">Reference: {submissionId}</p>
            </div>
        );
    }

    return (
        <form className="one-photo-form" onSubmit={handleSubmit}>
            <div className="one-photo-helper-card">
                <p className="rw-kicker">Submission format</p>
                <p>
                    You can submit only text, only audio, only one image, or any combination of the
                    three.
                </p>
                <a className="one-photo-helper-card__link" href="/one-photo/responses">
                    See all responses
                </a>
            </div>

            <div className="one-photo-hidden-field" aria-hidden="true">
                <label htmlFor="website">Leave this blank</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            {errorMessage ? (
                <div className="rw-mini-banner" role="alert">
                    <AlertCircle size={16} />
                    <span>{errorMessage}</span>
                </div>
            ) : null}

            {recorderMessage ? (
                <div className="one-photo-inline-note" role="status">
                    <AlertCircle size={16} />
                    <span>{recorderMessage}</span>
                </div>
            ) : null}

            <label className="one-photo-field">
                <span className="rw-label">Write the story behind the photograph</span>
                <textarea
                    className="rw-textarea"
                    value={story}
                    onChange={(event) => setStory(event.target.value)}
                    placeholder="What is the one image that stays with you, and why that one?"
                    rows={7}
                    maxLength={12000}
                />
            </label>

            <section className="one-photo-panel">
                <div className="one-photo-panel__header">
                    <div className="one-photo-panel__title">
                        <Mic size={16} />
                        <span className="rw-label">Optional audio note</span>
                    </div>
                    <p>Record your response here if speaking feels easier than typing.</p>
                </div>

                {!isRecording && !audioBlob ? (
                    <button
                        className="rw-button rw-button--secondary"
                        type="button"
                        onClick={startRecording}
                    >
                        <Mic size={16} />
                        <span>Start recording</span>
                    </button>
                ) : null}

                {isRecording ? (
                    <div className="one-photo-recorder-live">
                        <div className="one-photo-status">
                            <span className="one-photo-status-dot" aria-hidden="true"></span>
                            <span>Recording now</span>
                            <strong>{formatTime(elapsedSeconds)}</strong>
                        </div>
                        <button
                            className="rw-button rw-button--primary"
                            type="button"
                            onClick={stopRecording}
                        >
                            <Square size={16} />
                            <span>Stop recording</span>
                        </button>
                    </div>
                ) : null}

                {!isRecording && audioBlob ? (
                    <div className="one-photo-media-card">
                        <audio controls src={audioPreviewUrl}></audio>
                        <div className="one-photo-media-card__meta">
                            <span>
                                Audio note saved: {formatTime(audioDurationSeconds)} ·{' '}
                                {formatBytes(audioBlob.size)}
                            </span>
                            <button type="button" onClick={resetAudio}>
                                Record again
                            </button>
                        </div>
                    </div>
                ) : null}
            </section>

            <section className="one-photo-panel">
                <div className="one-photo-panel__header">
                    <div className="one-photo-panel__title">
                        <ImagePlus size={16} />
                        <span className="rw-label">Optional image</span>
                    </div>
                    <p>Upload one image if you want the story to stay attached to the photograph.</p>
                </div>

                <input
                    ref={imageInputRef}
                    className="rw-hidden-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    tabIndex={-1}
                />

                {imagePreviewUrl ? (
                    <div className="one-photo-image-card">
                        <img src={imagePreviewUrl} alt="Selected upload preview" />
                        <div className="one-photo-media-card__meta">
                            <span>
                                {imageFile?.name} · {formatBytes(imageFile?.size || 0)}
                            </span>
                            <button type="button" onClick={clearImage}>
                                Remove image
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="one-photo-upload-card"
                        type="button"
                        onClick={openImagePicker}
                    >
                        <div className="one-photo-upload-card__icon">
                            <UploadCloud size={18} />
                        </div>
                        <div className="one-photo-upload-card__copy">
                            <strong>Choose one image</strong>
                            <span>Phone photos are completely fine.</span>
                        </div>
                    </button>
                )}
            </section>

            <div className="one-photo-submit-row">
                <p className="one-photo-submit-note">
                    All fields are optional, but at least one response is required.
                </p>
                <button
                    className="rw-button rw-button--primary one-photo-submit-button"
                    type="submit"
                    disabled={isSubmitting || isRecording}
                >
                    {isSubmitting ? (
                        <>
                            <span>Submitting...</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={16} />
                            <span>Submit response</span>
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
