import { useEffect, useMemo, useState } from 'react';

const readMediaResponse = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Could not open the media library.');
    return payload;
};

const parentFolder = (folder) => folder.split('/').filter(Boolean).slice(0, -1).join('/');

export default function NewsletterMediaPicker({ accessToken, onSelect, gifOnly = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [folder, setFolder] = useState('originals');
    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen || !accessToken) return undefined;

        const controller = new AbortController();
        setLoading(true);
        setError('');
        const params = new URLSearchParams();
        if (folder) params.set('folder', folder);

        fetch(`/api/admin/media?${params.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
        })
            .then(readMediaResponse)
            .then((payload) => {
                setFolders(payload.folders || []);
                setFiles((payload.files || []).filter((file) => {
                    if (!file.mimeType?.startsWith('image/')) return false;
                    if (!gifOnly) return true;
                    return file.mimeType === 'image/gif' || /\.gif(?:[?#]|$)/i.test(file.publicUrl || file.name || '');
                }));
            })
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') setError(loadError.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [accessToken, folder, gifOnly, isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [isOpen]);

    const locationLabel = useMemo(() => folder || 'All media', [folder]);

    const chooseImage = (file) => {
        onSelect({
            imageUrl: file.publicUrl,
            alt: file.altText || file.name || '',
            objectKey: file.objectKey,
        });
        setIsOpen(false);
    };

    return (
        <>
            <button
                type="button"
                className="media-library-picker-trigger"
                onClick={() => setIsOpen(true)}
                disabled={!accessToken}
                title={accessToken ? `Choose an existing ${gifOnly ? 'GIF' : 'image'}` : 'Media library access is unavailable'}
            >
                Choose {gifOnly ? 'GIF' : 'image'} from media library
            </button>

            {isOpen && (
                <div className="newsletter-media-picker-backdrop" onMouseDown={() => setIsOpen(false)}>
                    <section
                        className="newsletter-media-picker"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="newsletter-media-picker-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <header>
                            <div>
                                <span>Media library</span>
                                <h3 id="newsletter-media-picker-title">Choose {gifOnly ? 'a GIF' : 'an image'}</h3>
                            </div>
                            <button type="button" className="media-picker-close" onClick={() => setIsOpen(false)} aria-label="Close media library">×</button>
                        </header>

                        <div className="media-picker-location">
                            <button type="button" onClick={() => setFolder('')} disabled={!folder}>All media</button>
                            {folder && <span>/ {locationLabel}</span>}
                            {folder && <button type="button" className="media-picker-up" onClick={() => setFolder(parentFolder(folder))}>Up one folder</button>}
                        </div>

                        {error && <div className="media-picker-message" role="alert">{error}</div>}

                        <div className="media-picker-grid" aria-busy={loading}>
                            {loading && <div className="media-picker-state">Loading images…</div>}
                            {!loading && folders.map((mediaFolder) => (
                                <button key={mediaFolder.path} type="button" className="media-picker-folder" onClick={() => setFolder(mediaFolder.path)}>
                                    <span aria-hidden="true">↳</span>
                                    <strong>{mediaFolder.name}</strong>
                                </button>
                            ))}
                            {!loading && files.map((file) => (
                                <button key={file.objectKey} type="button" className="media-picker-image" onClick={() => chooseImage(file)}>
                                    <img src={file.publicUrl} alt="" loading="lazy" />
                                    <span>{file.name}</span>
                                </button>
                            ))}
                            {!loading && !folders.length && !files.length && !error && (
                                <div className="media-picker-state">No {gifOnly ? 'GIFs' : 'images'} are available in this folder.</div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}
