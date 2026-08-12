import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    listPhotoStoryAssets,
    syncPhotoStoriesFromPhotography,
    upsertPhotoStoryByUrl,
    upsertPhotoStoryLabelsByUrl,
} from '../../lib/services/photoStories';
import AdminPageHeader from './AdminPageHeader';

function formatDate(value) {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString();
}

async function preloadPhotoAssets(rows, onProgress) {
    const photoUrls = Array.from(
        new Set(rows.map((row) => row.photoUrl).filter(Boolean)),
    );
    let loaded = 0;

    onProgress({ loaded, total: photoUrls.length });

    await Promise.all(
        photoUrls.map(
            (photoUrl) => new Promise((resolve) => {
                const photo = new Image();
                let settled = false;
                let timeoutId;

                const finish = () => {
                    if (settled) return;
                    settled = true;
                    window.clearTimeout(timeoutId);
                    photo.onload = null;
                    photo.onerror = null;
                    loaded += 1;
                    onProgress({ loaded, total: photoUrls.length });
                    resolve();
                };

                photo.onload = finish;
                photo.onerror = finish;
                photo.decoding = 'async';
                photo.src = photoUrl;
                timeoutId = window.setTimeout(finish, 15000);

                if (photo.complete) finish();
            }),
        ),
    );
}

function PhotoLoadingCounter({ loaded, total }) {
    const hasPhotos = total > 0;
    const progress = hasPhotos ? Math.min(100, (loaded / total) * 100) : 0;
    const label = hasPhotos && loaded >= total
        ? 'Photos ready'
        : loaded === 1
            ? 'photo loading'
            : 'photos loading';

    return (
        <div
            className="photo-story-loading"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={hasPhotos ? `${loaded} of ${total} photos loaded` : 'Finding photos to load'}
        >
            <span className="photo-story-loading-kicker" aria-hidden="true">Preparing photo buckets</span>
            <strong className="photo-story-loading-number" aria-hidden="true">
                {loaded.toLocaleString()}
                {hasPhotos && <span>/{total.toLocaleString()}</span>}
            </strong>
            <span className="photo-story-loading-label" aria-hidden="true">{label}</span>
            <span className="photo-story-loading-track" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
            </span>
        </div>
    );
}

export default function PhotoStoryManager() {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [photoLoadProgress, setPhotoLoadProgress] = useState({ loaded: 0, total: 0 });
    const [syncing, setSyncing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [labelSaving, setLabelSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [notice, setNotice] = useState('');
    const [selectedPhotoUrl, setSelectedPhotoUrl] = useState('');
    const [storyDraft, setStoryDraft] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
    const noticeTimeoutRef = useRef(null);

    const selectedAsset = useMemo(
        () => assets.find((asset) => asset.photoUrl === selectedPhotoUrl) || null,
        [assets, selectedPhotoUrl],
    );

    const completedCount = useMemo(
        () => assets.filter((asset) => asset.hasStory).length,
        [assets],
    );

    const showNotice = (message) => {
        setNotice(message);
        window.clearTimeout(noticeTimeoutRef.current);
        noticeTimeoutRef.current = window.setTimeout(() => setNotice(''), 3000);
    };

    const loadAssets = async ({ runSync = false } = {}) => {
        setErrorMsg('');
        if (runSync) setSyncing(true);
        if (!runSync) {
            setLoading(true);
            setPhotoLoadProgress({ loaded: 0, total: 0 });
        }

        try {
            if (runSync) {
                const syncResult = await syncPhotoStoriesFromPhotography();
                showNotice(
                    `Sync complete: ${syncResult.insertedCount} new rows added (${syncResult.totalRows} total).`,
                );
            }

            const rows = await listPhotoStoryAssets();
            setAssets(rows);

            setSelectedPhotoUrl((current) => {
                const keepCurrent = current && rows.some((row) => row.photoUrl === current);
                if (keepCurrent) return current;
                return rows[0]?.photoUrl || '';
            });

            if (!runSync) {
                await preloadPhotoAssets(rows, setPhotoLoadProgress);
            }
        } catch (error) {
            console.error(error);
            setErrorMsg(error?.message || 'Failed to load photo stories.');
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    };

    useEffect(() => {
        loadAssets({ runSync: false });
    }, []);

    useEffect(() => {
        return () => window.clearTimeout(noticeTimeoutRef.current);
    }, []);

    useEffect(() => {
        if (!selectedAsset) {
            setStoryDraft('');
            setIsDirty(false);
            return;
        }
        setStoryDraft(selectedAsset.storyMarkdown || selectedAsset.sampleStoryMarkdown || '');
        setIsDirty(false);
    }, [selectedAsset?.photoUrl, selectedAsset?.storyMarkdown, selectedAsset?.sampleStoryMarkdown]);

    const handleSelectPhoto = (photoUrl) => {
        if (photoUrl !== selectedPhotoUrl && isDirty) {
            const confirmLeave = window.confirm(
                'You have unsaved text for this photo. Switch anyway?',
            );
            if (!confirmLeave) return;
        }

        setSelectedPhotoUrl(photoUrl);
    };

    const handleUpdateStory = async () => {
        if (!selectedAsset) return;

        setSaving(true);
        setErrorMsg('');

        try {
            const saved = await upsertPhotoStoryByUrl(selectedAsset.photoUrl, storyDraft);

            setAssets((prev) =>
                prev.map((asset) => {
                    if (asset.photoUrl !== selectedAsset.photoUrl) return asset;

                    const nextStory = saved.story_markdown || '';
                    return {
                        ...asset,
                        storyId: saved.id,
                        storyMarkdown: nextStory,
                        sampleStoryMarkdown: saved.sample_story_markdown || asset.sampleStoryMarkdown || '',
                        effectiveStoryMarkdown: nextStory || saved.sample_story_markdown || asset.sampleStoryMarkdown || '',
                        isStoryLocked: Boolean(saved.is_story_locked),
                        hasStory: Boolean(saved.is_story_locked),
                        storyUpdatedAt: saved.updated_at,
                        storyCreatedAt: saved.created_at,
                    };
                }),
            );

            setIsDirty(false);
            showNotice('Story updated and locked to this photo URL.');
        } catch (error) {
            console.error(error);
            setErrorMsg(error?.message || 'Failed to update story.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleLabel = async (labelKey) => {
        if (!selectedAsset) return;

        const isArtToggle = labelKey === 'art';
        const nextValue = isArtToggle ? !selectedAsset.isArt : !selectedAsset.isCommercial;
        setLabelSaving(true);
        setErrorMsg('');

        try {
            const saved = await upsertPhotoStoryLabelsByUrl(selectedAsset.photoUrl, {
                isArt: isArtToggle ? nextValue : undefined,
                isCommercial: isArtToggle ? undefined : nextValue,
            });

            setAssets((prev) =>
                prev.map((asset) => {
                    if (asset.photoUrl !== selectedAsset.photoUrl) return asset;
                    return {
                        ...asset,
                        storyId: saved.id,
                        sampleStoryMarkdown: saved.sample_story_markdown || asset.sampleStoryMarkdown || '',
                        effectiveStoryMarkdown: (saved.story_markdown || asset.storyMarkdown || '') || (saved.sample_story_markdown || asset.sampleStoryMarkdown || ''),
                        isStoryLocked: Boolean(saved.is_story_locked),
                        hasStory: Boolean(saved.is_story_locked),
                        isArt: Boolean(saved.is_art),
                        isCommercial: Boolean(saved.is_commercial),
                        storyUpdatedAt: saved.updated_at,
                        storyCreatedAt: saved.created_at,
                    };
                }),
            );
        } catch (error) {
            console.error(error);
            setErrorMsg(error?.message || 'Failed to update labels.');
        } finally {
            setLabelSaving(false);
        }
    };

    return (
        <section className="photo-story-manager" aria-labelledby="photo-stories-title">
            <div className="photo-story-header">
                <AdminPageHeader
                    className="photo-story-page-header"
                    headingId="photo-stories-title"
                    title="Photo Stories"
                    description="Every photo carries a story."
                />
                {!loading && (
                    <div className="photo-story-header-actions">
                        <div className="photo-story-count" aria-label={`${completedCount} of ${assets.length} photo stories completed`}>
                            <strong>{completedCount}<span>/{assets.length}</span></strong>
                            <small>stories completed</small>
                        </div>
                        <button
                            className="sync-btn"
                            onClick={() => loadAssets({ runSync: true })}
                            disabled={syncing || saving || labelSaving}
                        >
                            {syncing ? 'Syncing...' : 'Sync New Photos'}
                        </button>
                    </div>
                )}
            </div>

            {notice && <div className="photo-story-notice success">{notice}</div>}
            {errorMsg && <div className="photo-story-notice error">{errorMsg}</div>}

            {loading ? (
                <PhotoLoadingCounter
                    loaded={photoLoadProgress.loaded}
                    total={photoLoadProgress.total}
                />
            ) : (
            <div className="photo-story-layout">
                <section className="photo-grid-panel">
                    <div className="panel-title">Photo Buckets</div>
                    <div className="photo-grid">
                        {assets.map((asset) => (
                            <button
                                key={asset.photoUrl}
                                className={`photo-tile ${asset.photoUrl === selectedPhotoUrl ? 'active' : ''}`}
                                onClick={() => handleSelectPhoto(asset.photoUrl)}
                                title={asset.projectTitle}
                            >
                                <img src={asset.photoUrl} alt={asset.projectTitle} loading="lazy" />
                                <span className={`story-dot ${asset.hasStory ? 'done' : 'pending'}`} />
                                <span className="photo-tile-meta">
                                    {asset.sourceType === 'cover' ? 'Cover' : 'Gallery'}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                <aside className="story-editor-panel">
                    <div className="panel-title">Story of the Photo</div>
                    {selectedAsset ? (
                        <>
                            <div className="selected-meta">
                                <div className="selected-meta-title">{selectedAsset.projectTitle}</div>
                                <div className="selected-meta-sub">
                                    Last update: {formatDate(selectedAsset.storyUpdatedAt)}
                                </div>
                                {!selectedAsset.isStoryLocked && (
                                    <div className="selected-meta-sub">
                                        Sample story mode. Click Update Story to lock this one as final.
                                    </div>
                                )}
                            </div>

                            <div className="label-toggle-row">
                                <button
                                    className={`label-pill art ${selectedAsset.isArt ? 'active' : ''}`}
                                    onClick={() => handleToggleLabel('art')}
                                    disabled={labelSaving || saving}
                                >
                                    Art
                                </button>
                                <button
                                    className={`label-pill commercial ${selectedAsset.isCommercial ? 'active' : ''}`}
                                    onClick={() => handleToggleLabel('commercial')}
                                    disabled={labelSaving || saving}
                                >
                                    Commercial
                                </button>
                            </div>

                            <div className={`story-workspace ${isPreviewExpanded ? 'preview-expanded' : ''}`}>
                                <div className={`selected-photo-preview ${isPreviewExpanded ? 'expanded' : ''}`}>
                                    <img
                                        src={selectedAsset.photoUrl}
                                        alt={`${selectedAsset.projectTitle} preview`}
                                        loading="lazy"
                                    />
                                    <div className="preview-controls">
                                        <button
                                            className="preview-control-btn expand"
                                            onClick={() => setIsPreviewExpanded((prev) => !prev)}
                                            aria-label={isPreviewExpanded ? 'Shrink photo preview' : 'Expand photo preview'}
                                        >
                                            <span className="expand-icon" aria-hidden="true" />
                                        </button>
                                        {isPreviewExpanded && (
                                            <button
                                                className="preview-control-btn close"
                                                onClick={() => setIsPreviewExpanded(false)}
                                                aria-label="Close expanded preview"
                                            >
                                                x
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="story-editor-column">
                                    <textarea
                                        className="story-textarea"
                                        value={storyDraft}
                                        onChange={(event) => {
                                            setStoryDraft(event.target.value);
                                            setIsDirty(true);
                                        }}
                                        placeholder="Write a short markdown-style story for this photo..."
                                    />

                                    <div className="story-editor-actions">
                                        <button
                                            className="update-story-btn"
                                            disabled={saving || labelSaving}
                                            onClick={handleUpdateStory}
                                        >
                                            {saving ? 'Updating...' : 'Update Story'}
                                        </button>
                                        <button
                                            className="reset-story-btn"
                                            disabled={saving || labelSaving}
                                    onClick={() => {
                                        setStoryDraft(selectedAsset.storyMarkdown || selectedAsset.sampleStoryMarkdown || '');
                                        setIsDirty(false);
                                    }}
                                >
                                    Reset
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="story-url">
                                URL: <code>{selectedAsset.photoUrl}</code>
                            </div>
                        </>
                    ) : (
                        <p className="empty-select">Select a photo to edit its story.</p>
                    )}
                </aside>
            </div>
            )}

            <style>{`
                .photo-story-loading {
                    min-height: min(58vh, 520px);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    background: var(--bg-surface);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.42rem;
                    overflow: hidden;
                    padding: 2rem;
                    text-align: center;
                }

                .photo-story-loading-kicker {
                    color: var(--text-tertiary);
                    font-size: 0.62rem;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }

                .photo-story-loading-number {
                    color: var(--text-primary);
                    font-size: clamp(3.75rem, 8vw, 6.5rem);
                    font-variant-numeric: tabular-nums;
                    font-weight: 650;
                    letter-spacing: -0.065em;
                    line-height: 0.95;
                }

                .photo-story-loading-number span {
                    color: var(--text-tertiary);
                    font-size: 0.32em;
                    font-weight: 400;
                    letter-spacing: -0.035em;
                }

                .photo-story-loading-label {
                    color: var(--text-secondary);
                    font-size: 0.76rem;
                    font-weight: 650;
                    letter-spacing: 0.02em;
                }

                .photo-story-loading-track {
                    width: min(260px, 55vw);
                    height: 2px;
                    margin-top: 0.65rem;
                    border-radius: 999px;
                    background: var(--border-subtle);
                    overflow: hidden;
                }

                .photo-story-loading-track > span {
                    display: block;
                    width: 0;
                    height: 100%;
                    border-radius: inherit;
                    background: var(--text-secondary);
                    transition: width 100ms linear;
                }

                .photo-story-manager {
                    width: 100%;
                    max-width: var(--admin-page-content-max);
                    display: flex;
                    flex-direction: column;
                    gap: 0.85rem;
                }

                .photo-story-header {
                    display: flex;
                    justify-content: space-between;
                    gap: 2rem;
                    align-items: flex-end;
                    padding: var(--admin-page-heading-offset-block) var(--admin-page-heading-offset-inline) 1.5rem;
                    border-bottom: 1px solid var(--border-subtle);
                }

                .photo-story-page-header {
                    min-width: 0;
                    flex: 1 1 34rem;
                }

                .photo-story-header-actions {
                    display: flex;
                    align-items: center;
                    flex: 0 0 auto;
                    gap: 0.9rem;
                    padding-bottom: 0.25rem;
                }

                .photo-story-count {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 0.15rem;
                }

                .photo-story-count strong {
                    color: var(--text-primary);
                    font-size: var(--admin-page-subtitle-size);
                    font-weight: 420;
                    line-height: 1;
                    letter-spacing: -0.035em;
                }

                .photo-story-count strong span {
                    color: var(--text-tertiary);
                    font-weight: 300;
                }

                .photo-story-count small {
                    color: var(--text-tertiary);
                    font-size: 0.62rem;
                }

                .sync-btn {
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-surface);
                    color: var(--text-primary);
                    border-radius: 8px;
                    padding: 0.55rem 0.85rem;
                    cursor: pointer;
                    font-size: 0.78rem;
                    font-weight: 600;
                }

                .sync-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .photo-story-notice {
                    border-radius: 8px;
                    padding: 0.6rem 0.75rem;
                    font-size: 0.8rem;
                }

                .photo-story-notice.success {
                    background: rgba(16, 185, 129, 0.12);
                    border: 1px solid rgba(16, 185, 129, 0.35);
                    color: #34d399;
                }

                .photo-story-notice.error {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.35);
                    color: #fca5a5;
                }

                .photo-story-layout {
                    display: grid;
                    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 1fr);
                    gap: 1rem;
                    min-height: 66vh;
                }

                .photo-grid-panel,
                .story-editor-panel {
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-surface);
                    border-radius: 12px;
                    padding: 0.8rem;
                    min-height: 0;
                }

                .panel-title {
                    font-size: 0.75rem;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--text-secondary);
                    margin-bottom: 0.7rem;
                    font-weight: 700;
                }

                .photo-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
                    gap: 0.7rem;
                    max-height: calc(66vh - 2rem);
                    overflow: auto;
                    padding-right: 0.2rem;
                }

                .photo-tile {
                    border: 1px solid var(--border-subtle);
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.02);
                    cursor: pointer;
                    padding: 0;
                    position: relative;
                    aspect-ratio: 1 / 1;
                    overflow: hidden;
                }

                .photo-tile.active {
                    border-color: rgba(59, 130, 246, 0.8);
                    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
                }

                .photo-tile img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .story-dot {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
                }

                .story-dot.pending {
                    background: #3b82f6;
                }

                .story-dot.done {
                    background: #10b981;
                }

                .photo-tile-meta {
                    position: absolute;
                    left: 7px;
                    bottom: 7px;
                    font-size: 0.62rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #f8fafc;
                    background: rgba(0, 0, 0, 0.56);
                    border-radius: 6px;
                    padding: 0.15rem 0.4rem;
                    border: 1px solid rgba(255, 255, 255, 0.25);
                }

                .story-editor-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 0.8rem;
                }

                .label-toggle-row {
                    display: flex;
                    gap: 0.5rem;
                }

                .label-pill {
                    border: 1px solid var(--border-subtle);
                    background: transparent;
                    color: var(--text-secondary);
                    border-radius: 999px;
                    padding: 0.3rem 0.75rem;
                    font-size: 0.72rem;
                    font-weight: 700;
                    letter-spacing: 0.02em;
                    cursor: pointer;
                    transition: all 160ms ease;
                }

                .label-pill.active.art {
                    border-color: rgba(56, 189, 248, 0.75);
                    color: #67e8f9;
                    background: rgba(56, 189, 248, 0.15);
                }

                .label-pill.active.commercial {
                    border-color: rgba(249, 115, 22, 0.75);
                    color: #fdba74;
                    background: rgba(249, 115, 22, 0.16);
                }

                .label-pill:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .selected-meta-title {
                    font-size: 0.95rem;
                    font-weight: 650;
                }

                .selected-meta-sub {
                    font-size: 0.72rem;
                    color: var(--text-secondary);
                    margin-top: 0.25rem;
                }

                .story-workspace {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 0.65rem;
                    min-height: 0;
                }

                .story-workspace.preview-expanded {
                    grid-template-columns: minmax(220px, 42%) minmax(0, 1fr);
                    align-items: stretch;
                }

                .selected-photo-preview {
                    position: relative;
                    border: 1px solid var(--border-subtle);
                    border-radius: 10px;
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.03);
                    height: 120px;
                }

                .selected-photo-preview.expanded {
                    height: min(54vh, 430px);
                }

                .selected-photo-preview img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .preview-controls {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    display: flex;
                    gap: 0.4rem;
                }

                .preview-control-btn {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.42);
                    background: rgba(0, 0, 0, 0.62);
                    color: #f8fafc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    padding: 0;
                }

                .preview-control-btn:hover {
                    border-color: rgba(59, 130, 246, 0.8);
                }

                .preview-control-btn.close {
                    font-size: 0.9rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .expand-icon {
                    width: 12px;
                    height: 12px;
                    position: relative;
                    display: block;
                }

                .expand-icon::before,
                .expand-icon::after {
                    content: '';
                    position: absolute;
                    width: 7px;
                    height: 7px;
                    border: 1.4px solid currentColor;
                }

                .expand-icon::before {
                    top: 0;
                    right: 0;
                    border-left: none;
                    border-bottom: none;
                }

                .expand-icon::after {
                    left: 0;
                    bottom: 0;
                    border-right: none;
                    border-top: none;
                }

                .story-editor-column {
                    display: flex;
                    flex-direction: column;
                    gap: 0.55rem;
                    min-width: 0;
                }

                .story-textarea {
                    width: 100%;
                    min-height: 260px;
                    resize: vertical;
                    border: 1px solid var(--border-subtle);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.28);
                    color: #f8fafc;
                    font-family: var(--font-mono);
                    font-size: 0.9rem;
                    line-height: 1.55;
                    padding: 0.75rem;
                }

                .story-editor-actions {
                    display: flex;
                    gap: 0.55rem;
                }

                .update-story-btn,
                .reset-story-btn {
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    padding: 0.5rem 0.8rem;
                    font-size: 0.75rem;
                    font-weight: 650;
                    cursor: pointer;
                }

                .update-story-btn {
                    background: #2563eb;
                    border-color: #2563eb;
                    color: #ffffff;
                }

                .update-story-btn:disabled,
                .reset-story-btn:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                }

                .reset-story-btn {
                    background: transparent;
                    color: var(--text-primary);
                }

                .story-url {
                    font-size: 0.69rem;
                    color: var(--text-secondary);
                    word-break: break-word;
                    margin-top: auto;
                }

                .story-url code {
                    font-size: 0.66rem;
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    padding: 0.12rem 0.3rem;
                }

                .empty-select {
                    margin: 0;
                    color: var(--text-secondary);
                    font-size: 0.82rem;
                }

                @media (max-width: 1100px) {
                    .photo-story-layout {
                        grid-template-columns: 1fr;
                        min-height: auto;
                    }

                    .photo-grid {
                        max-height: 52vh;
                    }

                    .story-workspace.preview-expanded {
                        grid-template-columns: 1fr;
                    }

                    .selected-photo-preview.expanded {
                        height: min(42vh, 320px);
                    }
                }
                @media (max-width: 1180px) {
                    .photo-story-header {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .photo-story-header-actions {
                        width: 100%;
                        justify-content: space-between;
                    }

                    .photo-story-count {
                        align-items: flex-start;
                    }
                }
            `}</style>
        </section>
    );
}
