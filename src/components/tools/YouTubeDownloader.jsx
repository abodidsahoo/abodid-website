import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../../styles/youtube-downloader.css';

const STORAGE_KEY = 'abodid_yt_downloader_queue';

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return null;
  const num = Number(bytes);
  if (num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${(num / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function YouTubeDownloader() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'audio' | 'video-only'
  const [queue, setQueue] = useState([]);
  const [showQueue, setShowQueue] = useState(false);
  const inputRef = useRef(null);

  // Load download history / queue from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setQueue(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Could not read saved downloads', e);
    }
  }, []);

  // Save queue updates
  const saveQueue = (nextQueue) => {
    setQueue((currentQueue) => {
      const items = typeof nextQueue === 'function'
        ? nextQueue(currentQueue)
        : nextQueue;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.warn('Could not persist downloads', e);
      }

      return items;
    });
  };

  const handleClearHistory = () => {
    saveQueue([]);
  };

  const handleRemoveQueueItem = (id) => {
    saveQueue((items) => items.filter((item) => item.id !== id));
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        inputRef.current?.focus();
      }
    } catch {
      // Browser permissions error fallback
      inputRef.current?.focus();
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const targetUrl = url.trim();
    if (!targetUrl) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/tools/yt-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to extract video information.');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Trigger download with stream proxy
  const handleDownload = (format, customExt) => {
    if (!result?.data) return;

    const videoTitle = result.data.title || 'video';
    const ext = customExt || (format.mimeType?.includes('audio') ? 'm4a' : 'mp4');
    const downloadUrl = result.data.downloadMode === 'native' && format.formatId
      ? `/api/tools/yt-download?url=${encodeURIComponent(result.data.sourceUrl)}&formatId=${encodeURIComponent(format.formatId)}&title=${encodeURIComponent(videoTitle)}&ext=${encodeURIComponent(ext)}`
      : `/api/tools/yt-stream?url=${encodeURIComponent(format.url)}&title=${encodeURIComponent(videoTitle)}&ext=${encodeURIComponent(ext)}`;

    const queueId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newItem = {
      id: queueId,
      title: videoTitle,
      thumbnail: result.data.thumbnail,
      quality: format.qualityLabel || format.audioQuality || (ext.toUpperCase()),
      ext,
      size: format.contentLength ? formatBytes(format.contentLength) : null,
      timestamp: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      status: 'starting',
    };

    saveQueue((items) => [newItem, ...items]);
    setShowQueue(true);

    // Trigger direct browser save via hidden anchor
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${videoTitle}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Browsers do not expose attachment completion to page JavaScript. Record
    // the state we can verify: the download request was handed to the browser.
    saveQueue((items) =>
      items.map((item) =>
        item.id === queueId ? { ...item, status: 'started' } : item
      )
    );
  };

  // Extract and organize formats
  const allFormats = result?.data?.formats || [];

  const videoFormats = useMemo(() => {
    const raw = allFormats.filter((f) => f.hasVideo);
    // Sort highest resolution first
    const sorted = [...raw].sort((a, b) => (b.height || 0) - (a.height || 0));
    const seen = new Set();
    return sorted.filter((f) => {
      const ext = f.mimeType?.includes('mp4') ? 'mp4' : 'webm';
      const key = `${f.qualityLabel || f.height || 'res'}-${ext}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allFormats]);

  const audioFormats = useMemo(() => {
    const raw = allFormats.filter((f) => f.hasAudio && !f.hasVideo);
    // Sort highest bitrate first
    const sorted = [...raw].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const seen = new Set();
    return sorted.filter((f) => {
      const ext = f.mimeType?.includes('m4a') ? 'm4a' : 'webm';
      const key = `${f.audioQuality || f.bitrate || 'aud'}-${ext}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allFormats]);

  const displayedFormats = activeTab === 'video' ? videoFormats : audioFormats;

  return (
    <div className="yt-utility-root">
      {/* Utility Header Badge */}
      <div className="yt-badge-row">
        <span className="yt-sub-tag">tools.js — media extractor</span>
        <span className="yt-status-tag">yt-dlp core • direct stream</span>
      </div>

      {/* Main Input Card */}
      <section className="yt-card yt-input-card">
        <form onSubmit={handleSubmit} className="yt-form">
          <label htmlFor="yt-url-input" className="yt-input-label">
            Paste a YouTube or Vimeo URL
          </label>
          <div className="yt-input-wrapper">
            <input
              id="yt-url-input"
              ref={inputRef}
              type="url"
              placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="yt-text-input"
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="yt-btn-subtle"
                aria-label="Clear URL"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={handlePaste}
              className="yt-btn-paste"
              title="Paste from clipboard"
            >
              Paste
            </button>
          </div>

          <div className="yt-form-actions">
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="yt-submit-btn"
            >
              {loading ? (
                <>
                  <span className="yt-spinner" aria-hidden="true" />
                  <span>Extracting stream...</span>
                </>
              ) : (
                <>
                  <span>Get Download Links</span>
                  <span className="yt-arrow" aria-hidden="true">→</span>
                </>
              )}
            </button>

            {queue.length > 0 && (
              <button
                type="button"
                onClick={() => setShowQueue(!showQueue)}
                className="yt-queue-toggle-btn"
              >
                <span>Downloads ({queue.length})</span>
                <span className="yt-pill-indicator">{queue.length}</span>
              </button>
            )}
          </div>
        </form>

        {/* Quick Tips */}
        <div className="yt-hints">
          <span>Supports YouTube videos, Shorts, playlists, and public Vimeo videos. Free & no registration.</span>
        </div>
      </section>

      {/* Error Banner */}
      {error && (
        <div className="yt-alert yt-alert-error" role="alert">
          <div className="yt-alert-icon">!</div>
          <div className="yt-alert-content">
            <strong>Unable to extract stream</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result?.data && (
        <section className="yt-card yt-result-card">
          <div className="yt-media-summary">
            {result.data.thumbnail && (
              <div className="yt-thumb-box">
                <img
                  src={result.data.thumbnail}
                  alt={result.data.title || 'Video preview'}
                  className="yt-thumb-img"
                />
                {result.data.duration > 0 && (
                  <span className="yt-duration-badge">
                    {formatDuration(result.data.duration)}
                  </span>
                )}
              </div>
            )}

            <div className="yt-media-meta">
              <span className="yt-author-badge">{result.data.author || 'Video Creator'}</span>
              <h2 className="yt-media-title">{result.data.title || 'Untitled Video'}</h2>
              <div className="yt-media-details">
                {result.data.isLive && <span className="yt-tag-live">LIVE STREAM</span>}
                <span>ID: {result.data.id}</span>
                <span>•</span>
                <span>{videoFormats.length} stream profiles available</span>
              </div>
            </div>
          </div>

          {/* Format Selector Tabs */}
          <div className="yt-tabs-bar">
            <button
              type="button"
              className={`yt-tab-btn ${activeTab === 'video' ? 'active' : ''}`}
              onClick={() => setActiveTab('video')}
            >
              Video ({videoFormats.length})
            </button>
            <button
              type="button"
              className={`yt-tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
              onClick={() => setActiveTab('audio')}
            >
              Audio Only ({audioFormats.length})
            </button>
          </div>

          {/* Formats Table / List */}
          <div className="yt-formats-list">
            {displayedFormats.length === 0 ? (
              <p className="yt-empty-tab">No formats found for this category.</p>
            ) : (
              displayedFormats.map((fmt, idx) => {
                const ext = fmt.mimeType?.includes('mp4')
                  ? 'mp4'
                  : fmt.mimeType?.includes('webm')
                  ? 'webm'
                  : fmt.mimeType?.includes('audio')
                  ? 'm4a'
                  : 'mp4';

                const sizeEstimate = fmt.contentLength
                  ? formatBytes(fmt.contentLength)
                  : fmt.bitrate && result.data.duration
                  ? formatBytes((fmt.bitrate / 8) * result.data.duration)
                  : null;

                const label = fmt.qualityLabel || (fmt.audioQuality ? `${fmt.audioQuality.replace('AUDIO_QUALITY_', '')}` : `${fmt.quality || 'Auto'}`);

                return (
                  <div key={fmt.itag || idx} className="yt-format-row">
                    <div className="yt-fmt-info">
                      <div className="yt-fmt-badge">{label}</div>
                      <div className="yt-fmt-text">
                        <span className="yt-fmt-codec">
                          {ext.toUpperCase()} {fmt.fps ? `• ${fmt.fps}fps` : ''}
                        </span>
                        {sizeEstimate && <span className="yt-fmt-size">~{sizeEstimate}</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownload(fmt, ext)}
                      className="yt-download-btn"
                    >
                      <span>Download</span>
                      <span className="yt-download-arrow" aria-hidden="true">↓</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Playlist Overview if URL was a playlist */}
      {result?.playlist && (
        <section className="yt-card yt-playlist-card">
          <div className="yt-playlist-header">
            <div>
              <span className="yt-sub-tag">Playlist Bundle</span>
              <h3 className="yt-playlist-title">{result.playlist.title}</h3>
              <p className="yt-playlist-count">
                {result.playlist.videos.length} videos curated by {result.playlist.author}
              </p>
            </div>
          </div>
          <div className="yt-playlist-videos">
            {result.playlist.videos.map((vid) => (
              <div key={vid.id} className="yt-playlist-item">
                {vid.thumbnail && (
                  <img src={vid.thumbnail} alt={vid.title} className="yt-playlist-thumb" />
                )}
                <div className="yt-playlist-info">
                  <span className="yt-playlist-item-title">{vid.title}</span>
                  <span className="yt-playlist-item-time">{formatDuration(vid.duration)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUrl(`https://www.youtube.com/watch?v=${vid.id}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="yt-btn-subtle"
                >
                  Load ↗
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Download History & Queue Drawer */}
      {showQueue && queue.length > 0 && (
        <section className="yt-card yt-queue-card">
          <div className="yt-queue-header">
            <div>
              <h3 className="yt-queue-title">Download Activity</h3>
              <p className="yt-queue-sub">Recent stream requests saved in local storage</p>
            </div>
            <button
              type="button"
              onClick={handleClearHistory}
              className="yt-btn-clear"
            >
              Clear all
            </button>
          </div>

          <div className="yt-queue-list">
            {queue.map((item) => (
              <div key={item.id} className="yt-queue-item">
                {item.thumbnail && (
                  <img src={item.thumbnail} alt="" className="yt-queue-thumb" />
                )}
                <div className="yt-queue-meta">
                  <span className="yt-queue-name">{item.title}</span>
                  <div className="yt-queue-pills">
                    <span className="yt-tag-pill">{item.quality}</span>
                    <span className="yt-tag-pill">{item.ext.toUpperCase()}</span>
                    {item.size && <span className="yt-tag-pill">{item.size}</span>}
                    <span className="yt-queue-time">{item.timestamp}</span>
                  </div>
                </div>
                <div className="yt-queue-actions">
                  <span className={`yt-status-pill ${item.status}`}>
                    {item.status === 'starting' ? 'Starting...' : 'Browser started'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveQueueItem(item.id)}
                    className="yt-queue-remove"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
