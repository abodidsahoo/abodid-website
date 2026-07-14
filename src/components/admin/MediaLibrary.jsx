import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CheckCircle2,
    ExternalLink,
    FileImage,
    FolderOpen,
    ImagePlus,
    LoaderCircle,
    RefreshCw,
    UploadCloud,
} from 'lucide-react';

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const formatBytes = (value) => {
    const bytes = Number(value || 0);
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const amount = bytes / (1024 ** unitIndex);
    return `${amount >= 10 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`;
};

const readImageDimensions = (file) => new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const finish = (dimensions) => {
        URL.revokeObjectURL(objectUrl);
        resolve(dimensions);
    };
    image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => finish({ width: null, height: null });
    image.src = objectUrl;
});

const readJsonResponse = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.error || `Request failed with status ${response.status}.`);
        error.code = payload.code;
        error.details = payload;
        throw error;
    }
    return payload;
};

export default function MediaLibrary({ accessToken }) {
    const [assets, setAssets] = useState([]);
    const [folder, setFolder] = useState('uploads');
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [catalogueReady, setCatalogueReady] = useState(false);
    const fileInputRef = useRef(null);

    const previewUrl = useMemo(
        () => selectedFile ? URL.createObjectURL(selectedFile) : '',
        [selectedFile],
    );

    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    const authorizedFetch = useCallback((url, options = {}) => fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
            Authorization: `Bearer ${accessToken}`,
        },
    }), [accessToken]);

    const loadAssets = useCallback(async () => {
        if (!accessToken) return;
        setLoading(true);
        setError('');
        try {
            const response = await authorizedFetch('/api/admin/media');
            const payload = await readJsonResponse(response);
            setAssets(payload.assets || []);
            setCatalogueReady(true);
        } catch (loadError) {
            setCatalogueReady(false);
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [accessToken, authorizedFetch]);

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const chooseFile = (file) => {
        setError('');
        setSuccess(null);
        if (!file) {
            setSelectedFile(null);
            return;
        }
        if (!ACCEPTED_TYPES.includes(file.type)) {
            setError('Choose a JPEG, PNG, WebP or GIF image.');
            return;
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            setError('Images must be 20 MB or smaller.');
            return;
        }
        setSelectedFile(file);
    };

    const uploadSelectedFile = async () => {
        if (!selectedFile || !catalogueReady || uploading) return;
        setUploading(true);
        setError('');
        setSuccess(null);

        try {
            const dimensionsPromise = readImageDimensions(selectedFile);
            const presignResponse = await authorizedFetch('/api/admin/media/presign', {
                method: 'POST',
                body: JSON.stringify({
                    filename: selectedFile.name,
                    contentType: selectedFile.type,
                    size: selectedFile.size,
                    folder,
                }),
            });
            const signed = await readJsonResponse(presignResponse);

            const uploadResponse = await fetch(signed.uploadUrl, {
                method: 'PUT',
                headers: signed.requiredHeaders,
                body: selectedFile,
            });
            if (!uploadResponse.ok) {
                throw new Error(`R2 rejected the upload with status ${uploadResponse.status}.`);
            }

            const dimensions = await dimensionsPromise;
            const completeResponse = await authorizedFetch('/api/admin/media/complete', {
                method: 'POST',
                body: JSON.stringify({
                    objectKey: signed.objectKey,
                    originalFilename: selectedFile.name,
                    expectedSize: selectedFile.size,
                    width: dimensions.width,
                    height: dimensions.height,
                }),
            });
            const completed = await readJsonResponse(completeResponse);

            setAssets((current) => [completed.asset, ...current.filter((item) => item.id !== completed.asset.id)]);
            setSuccess(completed.asset);
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (uploadError) {
            setError(uploadError.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setDragging(false);
        chooseFile(event.dataTransfer.files?.[0]);
    };

    return (
        <section className="media-library" aria-labelledby="media-library-title">
            <header className="media-library-header">
                <div>
                    <p className="media-library-kicker">Cloudflare R2 + Supabase</p>
                    <h2 id="media-library-title">Media Library</h2>
                    <p>Upload one image securely and confirm that its Cloudflare link is recorded in Supabase.</p>
                </div>
                <button type="button" className="refresh-button" onClick={loadAssets} disabled={loading || uploading}>
                    <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />
                    Refresh
                </button>
            </header>

            {error && (
                <div className="media-message media-message-error" role="alert">
                    <strong>Setup needs attention</strong>
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="media-message media-message-success" role="status">
                    <CheckCircle2 size={19} />
                    <div>
                        <strong>Upload verified</strong>
                        <span>The image is in R2 and its Supabase catalogue record is ready.</span>
                    </div>
                    <a href={success.publicUrl} target="_blank" rel="noreferrer">
                        Open image <ExternalLink size={14} />
                    </a>
                </div>
            )}

            <div className="media-workspace">
                <aside className="folder-panel" aria-label="Media folders">
                    <div className="folder-panel-heading">
                        <FolderOpen size={17} />
                        <strong>Upload folder</strong>
                    </div>
                    <label htmlFor="r2-folder">R2 folder path</label>
                    <input
                        id="r2-folder"
                        value={folder}
                        onChange={(event) => setFolder(event.target.value)}
                        placeholder="uk-2026"
                        disabled={uploading}
                    />
                    <p>For example: <code>uk-2026</code> or <code>projects/odisha</code>.</p>
                    <div className={`connection-status ${catalogueReady ? 'is-ready' : ''}`}>
                        <span />
                        {loading ? 'Checking catalogue…' : catalogueReady ? 'Catalogue ready' : 'Catalogue unavailable'}
                    </div>
                </aside>

                <div className="upload-panel">
                    <input
                        ref={fileInputRef}
                        className="visually-hidden-file-input"
                        type="file"
                        accept={ACCEPTED_TYPES.join(',')}
                        onChange={(event) => chooseFile(event.target.files?.[0])}
                        tabIndex={-1}
                    />
                    <button
                        type="button"
                        className={`drop-zone ${dragging ? 'is-dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                        onDragOver={(event) => event.preventDefault()}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        disabled={uploading}
                    >
                        {selectedFile ? (
                            <>
                                <img src={previewUrl} alt="Selected upload preview" />
                                <span className="selected-file-copy">
                                    <strong>{selectedFile.name}</strong>
                                    <small>{formatBytes(selectedFile.size)} · {selectedFile.type}</small>
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="drop-zone-icon"><UploadCloud size={28} /></span>
                                <strong>Choose an image or drop it here</strong>
                                <small>JPEG, PNG, WebP or GIF · maximum 20 MB</small>
                            </>
                        )}
                    </button>

                    <div className="upload-actions">
                        <span>{selectedFile ? `Destination: ${folder || 'uploads'}` : 'Select one image for the connection test.'}</span>
                        <button
                            type="button"
                            className="upload-button"
                            disabled={!selectedFile || !catalogueReady || uploading}
                            onClick={uploadSelectedFile}
                        >
                            {uploading ? <LoaderCircle size={17} className="is-spinning" /> : <ImagePlus size={17} />}
                            {uploading ? 'Uploading…' : 'Upload test image'}
                        </button>
                    </div>
                </div>
            </div>

            <section className="recent-media" aria-labelledby="recent-media-title">
                <div className="recent-media-heading">
                    <div>
                        <h3 id="recent-media-title">Recent R2 uploads</h3>
                        <p>{assets.length ? `${assets.length} most recent catalogue records` : 'No R2 uploads catalogued yet.'}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="media-loading"><LoaderCircle size={20} className="is-spinning" /> Loading media…</div>
                ) : assets.length > 0 ? (
                    <div className="media-grid">
                        {assets.map((asset) => (
                            <article className="media-card" key={asset.id}>
                                <a href={asset.publicUrl} target="_blank" rel="noreferrer" className="media-thumbnail">
                                    {asset.mimeType?.startsWith('image/') ? (
                                        <img src={asset.publicUrl} alt="" loading="lazy" />
                                    ) : (
                                        <FileImage size={28} />
                                    )}
                                </a>
                                <div className="media-card-copy">
                                    <strong title={asset.originalFilename}>{asset.originalFilename}</strong>
                                    <span>{asset.folderPath || 'Root'} · {formatBytes(asset.fileSize)}</span>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="media-empty">
                        <FileImage size={24} />
                        <span>Your first successful test upload will appear here.</span>
                    </div>
                )}
            </section>

            <style>{`
                .media-library { display: flex; flex-direction: column; gap: 1.25rem; animation: fadeIn 0.3s ease; }
                .media-library-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); }
                .media-library-kicker { margin: 0 0 0.45rem; color: var(--text-tertiary); font-size: 0.68rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; }
                .media-library-header h2 { margin: 0; color: var(--text-primary); font-size: clamp(1.8rem, 3vw, 2.7rem); font-weight: 620; letter-spacing: -0.045em; }
                .media-library-header p:not(.media-library-kicker) { max-width: 680px; margin: 0.55rem 0 0; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.55; }
                .refresh-button, .upload-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border-radius: 8px; cursor: pointer; font: inherit; font-size: 0.8rem; font-weight: 650; }
                .refresh-button { padding: 0.62rem 0.85rem; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-primary); }
                .refresh-button:disabled, .upload-button:disabled, .drop-zone:disabled { cursor: not-allowed; opacity: 0.55; }
                .media-message { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border: 1px solid; border-radius: 10px; font-size: 0.8rem; }
                .media-message strong, .media-message span { display: block; }
                .media-message span { margin-top: 0.18rem; color: var(--text-secondary); }
                .media-message-error { border-color: rgba(239, 68, 68, 0.38); background: rgba(239, 68, 68, 0.08); }
                .media-message-success { border-color: rgba(34, 197, 94, 0.35); background: rgba(34, 197, 94, 0.08); }
                .media-message-success > a { display: inline-flex; align-items: center; gap: 0.35rem; margin-left: auto; color: var(--text-primary); font-weight: 650; text-decoration: none; }
                .media-workspace { display: grid; grid-template-columns: minmax(210px, 0.3fr) minmax(0, 1fr); min-height: 330px; overflow: hidden; border: 1px solid var(--border-subtle); border-radius: 14px; background: var(--bg-surface); }
                .folder-panel { padding: 1.2rem; border-right: 1px solid var(--border-subtle); background: var(--bg-color); }
                .folder-panel-heading { display: flex; align-items: center; gap: 0.55rem; margin-bottom: 1.4rem; }
                .folder-panel-heading strong { font-size: 0.88rem; }
                .folder-panel label { display: block; margin-bottom: 0.45rem; color: var(--text-secondary); font-size: 0.7rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.05em; }
                .folder-panel input { width: 100%; box-sizing: border-box; padding: 0.68rem 0.72rem; border: 1px solid var(--border-subtle); border-radius: 7px; background: var(--bg-surface); color: var(--text-primary); font: inherit; font-size: 0.82rem; }
                .folder-panel p { margin: 0.6rem 0 1.4rem; color: var(--text-tertiary); font-size: 0.7rem; line-height: 1.45; }
                .folder-panel code { color: var(--text-secondary); }
                .connection-status { display: flex; align-items: center; gap: 0.45rem; color: var(--text-tertiary); font-size: 0.72rem; }
                .connection-status > span { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; }
                .connection-status.is-ready > span { background: #22c55e; }
                .upload-panel { display: flex; flex-direction: column; min-width: 0; padding: 1.2rem; }
                .drop-zone { flex: 1; width: 100%; min-height: 235px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.65rem; overflow: hidden; padding: 1.2rem; border: 1.5px dashed var(--border-strong); border-radius: 11px; background: var(--bg-color); color: var(--text-primary); cursor: pointer; font: inherit; }
                .drop-zone:hover, .drop-zone.is-dragging { border-color: var(--text-primary); background: var(--bg-surface-hover); }
                .visually-hidden-file-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
                .drop-zone-icon { width: 52px; height: 52px; display: grid; place-items: center; border: 1px solid var(--border-subtle); border-radius: 12px; color: var(--text-secondary); background: var(--bg-surface); }
                .drop-zone > strong { max-width: 100%; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .drop-zone > small { color: var(--text-tertiary); font-size: 0.72rem; }
                .drop-zone.has-file { display: grid; grid-template-columns: minmax(100px, 180px) minmax(0, 1fr); align-items: center; justify-items: stretch; text-align: left; }
                .drop-zone.has-file img { width: 100%; max-height: 190px; aspect-ratio: 4 / 3; object-fit: contain; border-radius: 9px; background: #070707; }
                .selected-file-copy { min-width: 0; display: flex; flex-direction: column; gap: 0.45rem; }
                .selected-file-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .selected-file-copy small { color: var(--text-tertiary); }
                .upload-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: 1rem; }
                .upload-actions > span { min-width: 0; overflow: hidden; color: var(--text-tertiary); font-size: 0.72rem; text-overflow: ellipsis; white-space: nowrap; }
                .upload-button { flex: 0 0 auto; padding: 0.7rem 1rem; border: 1px solid var(--text-primary); background: var(--text-primary); color: var(--bg-color); }
                .recent-media { overflow: hidden; border: 1px solid var(--border-subtle); border-radius: 14px; background: var(--bg-surface); }
                .recent-media-heading { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.1rem; border-bottom: 1px solid var(--border-subtle); }
                .recent-media-heading h3 { margin: 0; font-size: 0.9rem; }
                .recent-media-heading p { margin: 0.3rem 0 0; color: var(--text-tertiary); font-size: 0.68rem; }
                .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.85rem; padding: 1rem; }
                .media-card { min-width: 0; overflow: hidden; border: 1px solid var(--border-subtle); border-radius: 10px; background: var(--bg-color); }
                .media-thumbnail { aspect-ratio: 4 / 3; display: grid; place-items: center; overflow: hidden; background: #090909; color: var(--text-tertiary); }
                .media-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
                .media-card-copy { min-width: 0; display: flex; flex-direction: column; gap: 0.28rem; padding: 0.72rem; }
                .media-card-copy strong { overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
                .media-card-copy span { overflow: hidden; color: var(--text-tertiary); font-size: 0.64rem; text-overflow: ellipsis; white-space: nowrap; }
                .media-loading, .media-empty { min-height: 130px; display: flex; align-items: center; justify-content: center; gap: 0.55rem; color: var(--text-tertiary); font-size: 0.78rem; }
                .is-spinning { animation: media-spin 0.8s linear infinite; }
                @keyframes media-spin { to { transform: rotate(360deg); } }
                @media (max-width: 760px) {
                    .media-library-header { flex-direction: column; gap: 1rem; }
                    .media-workspace { grid-template-columns: 1fr; }
                    .folder-panel { border-right: 0; border-bottom: 1px solid var(--border-subtle); }
                    .drop-zone.has-file { grid-template-columns: 1fr; }
                    .upload-actions { align-items: stretch; flex-direction: column; }
                    .upload-button { width: 100%; }
                    .media-message-success { align-items: flex-start; flex-wrap: wrap; }
                    .media-message-success > a { width: 100%; margin-left: 1.95rem; }
                }
            `}</style>
        </section>
    );
}
