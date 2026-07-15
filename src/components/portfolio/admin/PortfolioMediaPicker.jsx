import { useEffect, useMemo, useState } from "react";
import { Check, Image as ImageIcon, LoaderCircle, Search, X } from "lucide-react";
import { searchPortfolioMediaAssets } from "../../../lib/portfolio/services";

export default function PortfolioMediaPicker({ open, onClose, onSelect }) {
  const [assets, setAssets] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    searchPortfolioMediaAssets()
      .then((rows) => { if (active) setAssets(rows); })
      .catch((loadError) => { if (active) setError(loadError.message || "Could not load the Media Library."); })
      .finally(() => { if (active) setLoading(false); });
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const visibleAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets
      .filter((asset) => !needle || `${asset.originalFilename} ${asset.objectKey}`.toLowerCase().includes(needle))
      .slice(0, 160);
  }, [assets, query]);

  if (!open) return null;
  const selected = assets.find((asset) => asset.id === selectedId) || null;

  return (
    <div className="portfolio-media-picker-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="portfolio-media-picker" role="dialog" aria-modal="true" aria-label="Choose from Media Library" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span className="editor-eyebrow">Cloudflare originals</span><h2>Choose from Media Library</h2></div>
          <button type="button" className="quiet-button" onClick={onClose} aria-label="Close Media Library"><X size={18} /></button>
        </header>
        <label className="portfolio-media-picker-search">
          <Search size={16} />
          <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filename, project or collection" />
        </label>
        {error && <div className="portfolio-media-picker-error">{error}</div>}
        <div className="portfolio-media-picker-grid">
          {loading ? (
            <div className="portfolio-media-picker-state"><LoaderCircle className="spin" size={22} /> Loading originals…</div>
          ) : visibleAssets.length ? visibleAssets.map((asset) => {
            const preview = asset.variants?.["800"]?.url || asset.originalUrl;
            return (
              <button type="button" className={selectedId === asset.id ? "is-selected" : ""} key={asset.id} onClick={() => setSelectedId(asset.id)} onDoubleClick={() => { onSelect(asset); onClose(); }}>
                <span className="portfolio-media-picker-thumb">
                  <ImageIcon size={22} />
                  <img src={preview} alt="" loading="lazy" />
                  {selectedId === asset.id && <i><Check size={15} /></i>}
                </span>
                <strong title={asset.originalFilename}>{asset.originalFilename}</strong>
                <small title={asset.objectKey}>{asset.objectKey.replace(/^originals\//, "")}</small>
                <em className={`media-state-${asset.processingStatus}`}>{asset.processingStatus === "ready" ? "Optimized" : "Original ready"}</em>
              </button>
            );
          }) : (
            <div className="portfolio-media-picker-state">No matching originals.</div>
          )}
        </div>
        <footer>
          <span>{visibleAssets.length}{visibleAssets.length < assets.length ? ` of ${assets.length}` : ""} assets shown</span>
          <button type="button" className="primary-button" disabled={!selected} onClick={() => { onSelect(selected); onClose(); }}>Use selected image</button>
        </footer>
      </section>
    </div>
  );
}
