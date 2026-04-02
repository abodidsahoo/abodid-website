import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    Expand,
    Image as ImageIcon,
    LoaderCircle,
    Pause,
    Play,
    Volume2,
    X,
} from 'lucide-react';

type OnePhotoResponse = {
    id: string;
    createdAt: string;
    responseText: string;
    imageUrl: string | null;
    audioUrl: string | null;
    audioDurationSeconds: number | null;
};

function formatTime(seconds: number): string {
    const totalSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainder = totalSeconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function formatDisplayDate(value: string): string {
    try {
        return new Intl.DateTimeFormat('en', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }).format(new Date(value));
    } catch (_error) {
        return '';
    }
}

function zigzagClass(index: number): string {
    const pattern = [
        'one-photo-response-card--offset-0',
        'one-photo-response-card--offset-1',
        'one-photo-response-card--offset-2',
        'one-photo-response-card--offset-3',
        'one-photo-response-card--offset-4',
        'one-photo-response-card--offset-5',
    ];

    return pattern[index % pattern.length];
}

function spanClass(response: OnePhotoResponse): string {
    const hasImage = Boolean(response.imageUrl);
    const hasAudio = Boolean(response.audioUrl);
    const textLength = response.responseText.length;

    if (hasImage && textLength > 280) return 'one-photo-response-card--wide';
    if (!hasImage && textLength > 340) return 'one-photo-response-card--textwide';
    if (hasImage && hasAudio) return 'one-photo-response-card--feature';
    return 'one-photo-response-card--standard';
}

function AudioPlayer({
    src,
    durationHint,
}: {
    src: string;
    durationHint: number | null;
}) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(durationHint || 0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleLoadedMetadata = () => {
            if (Number.isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        const handlePause = () => {
            setIsPlaying(false);
        };

        const handlePlay = () => {
            setIsPlaying(true);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('play', handlePlay);

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('play', handlePlay);
        };
    }, []);

    const togglePlayback = async () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            return;
        }

        try {
            await audio.play();
        } catch (_error) {
            setIsPlaying(false);
        }
    };

    const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

    return (
        <div className="one-photo-audio-player">
            <audio ref={audioRef} preload="metadata" src={src}></audio>
            <button
                className="one-photo-audio-player__button"
                type="button"
                onClick={togglePlayback}
                aria-label={isPlaying ? 'Pause audio response' : 'Play audio response'}
            >
                {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
            </button>

            <div className="one-photo-audio-player__body">
                <div className="one-photo-audio-player__meta">
                    <span>Audio response</span>
                    <span>{formatTime(duration || durationHint || 0)}</span>
                </div>
                <div className="one-photo-audio-player__progress" aria-hidden="true">
                    <span style={{ width: `${progressRatio * 100}%` }}></span>
                </div>
            </div>
        </div>
    );
}

function ResponseCard({
    response,
    index,
    onImageClick,
}: {
    response: OnePhotoResponse;
    index: number;
    onImageClick: (response: OnePhotoResponse) => void;
}) {
    const dateLabel = formatDisplayDate(response.createdAt);

    return (
        <article
            className={[
                'one-photo-response-card',
                zigzagClass(index),
                spanClass(response),
            ].join(' ')}
        >
            <div className="one-photo-response-card__inner">
                {response.imageUrl ? (
                    <button
                        className="one-photo-response-card__image-button"
                        type="button"
                        onClick={() => onImageClick(response)}
                    >
                        <img
                            className="one-photo-response-card__image"
                            src={response.imageUrl}
                            alt="Shared response image"
                            loading="lazy"
                        />
                        <span className="one-photo-response-card__expand">
                            <Expand size={14} />
                            <span>Open image</span>
                        </span>
                    </button>
                ) : null}

                {response.responseText ? (
                    <div className="one-photo-response-card__text">
                        <p>{response.responseText}</p>
                    </div>
                ) : (
                    <div className="one-photo-response-card__meta-block">
                        <ImageIcon size={16} />
                        <span>Shared without written text</span>
                    </div>
                )}

                {response.audioUrl ? (
                    <AudioPlayer
                        src={response.audioUrl}
                        durationHint={response.audioDurationSeconds}
                    />
                ) : null}

                <div className="one-photo-response-card__footer">
                    <span>{dateLabel || 'Recent response'}</span>
                </div>
            </div>
        </article>
    );
}

export default function OnePhotoResponsesWall() {
    const [responses, setResponses] = useState<OnePhotoResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [activeImage, setActiveImage] = useState<OnePhotoResponse | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadResponses = async () => {
            try {
                setIsLoading(true);
                setErrorMessage(null);

                const response = await fetch('/api/one-photo/responses');
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(payload.error || 'Could not load responses.');
                }

                if (isMounted) {
                    setResponses(Array.isArray(payload.responses) ? payload.responses : []);
                }
            } catch (error) {
                if (isMounted) {
                    setErrorMessage(
                        error instanceof Error ? error.message : 'Could not load responses.',
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadResponses();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!activeImage) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setActiveImage(null);
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [activeImage]);

    const responseCountLabel = useMemo(() => {
        if (responses.length === 0) return 'No responses yet';
        if (responses.length === 1) return '1 response';
        return `${responses.length} responses`;
    }, [responses.length]);

    return (
        <section className="one-photo-responses-shell">
            <header className="one-photo-responses-header">
                <a className="one-photo-responses-back" href="/one-photo">
                    <ArrowLeft size={16} />
                    <span>Back to submit page</span>
                </a>

                <div className="rw-eyebrow">
                    <span>One Photo Archive</span>
                </div>
                <h1>See all responses</h1>
                <p>
                    A growing wall of remembered photographs, written anchors, and voice notes from
                    people sharing the image that stays with them.
                </p>
                <p className="one-photo-responses-count">{responseCountLabel}</p>
            </header>

            {isLoading ? (
                <div className="one-photo-responses-state">
                    <LoaderCircle size={18} className="rw-spin" />
                    <span>Loading responses...</span>
                </div>
            ) : null}

            {!isLoading && errorMessage ? (
                <div className="one-photo-responses-state one-photo-responses-state--error">
                    <AlertCircle size={18} />
                    <span>{errorMessage}</span>
                </div>
            ) : null}

            {!isLoading && !errorMessage && responses.length === 0 ? (
                <div className="one-photo-responses-state">
                    <Volume2 size={18} />
                    <span>No responses have been shared yet.</span>
                </div>
            ) : null}

            {!isLoading && !errorMessage && responses.length > 0 ? (
                <div className="one-photo-responses-grid">
                    {responses.map((response, index) => (
                        <ResponseCard
                            key={response.id}
                            response={response}
                            index={index}
                            onImageClick={setActiveImage}
                        />
                    ))}
                </div>
            ) : null}

            {activeImage?.imageUrl ? (
                <div
                    className="one-photo-lightbox"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Expanded response image"
                    onClick={() => setActiveImage(null)}
                >
                    <button
                        className="one-photo-lightbox__close"
                        type="button"
                        onClick={() => setActiveImage(null)}
                        aria-label="Close image"
                    >
                        <X size={18} />
                    </button>
                    <figure
                        className="one-photo-lightbox__figure"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <img src={activeImage.imageUrl} alt="Expanded response image" />
                        {activeImage.responseText ? (
                            <figcaption>{activeImage.responseText}</figcaption>
                        ) : null}
                    </figure>
                </div>
            ) : null}
        </section>
    );
}
