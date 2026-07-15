import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, FolderOpen, Image as ImageIcon, LoaderCircle, Search, X } from "lucide-react";
import { browsePortfolioMediaFolder } from "../../../lib/portfolio/services";

const ROOT_FOLDER = "originals";

const breadcrumbsFor = (folderPath) => {
  const parts = folderPath.split("/").filter(Boolean);
  return parts.map((name, index) => ({
    name,
    path: parts.slice(0, index + 1).join("/"),
  }));
};

export default function PortfolioMediaPicker({ open, multiple = false, onClose, onSelect }) {
  const [assets, setAssets] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(ROOT_FOLDER);
  const [query, setQuery] = useState("");
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    browsePortfolioMediaFolder(currentFolder)
      .then((result) => {
        if (!active) return;
        setAssets(result.files);
        setFolders(result.folders);
        setTruncated(result.truncated);
      })
      .catch((loadError) => { if (active) setError(loadError.message || "Could not load the Media Library."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentFolder, open]);

  useEffect(() => {
    if (!open) return undefined;
    setSelectedAssets([]);
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [multiple, open, onClose]);

  const visibleFolders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return folders
      .filter((folder) => !needle || folder.name.toLowerCase().includes(needle))
      .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }));
  }, [folders, query]);

  const visibleAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets
      .filter((asset) => !needle || `${asset.originalFilename} ${asset.objectKey}`.toLowerCase().includes(needle))
      .sort((first, second) => first.originalFilename.localeCompare(second.originalFilename, undefined, { numeric: true }));
  }, [assets, query]);

  if (!open) return null;
  const breadcrumbs = breadcrumbsFor(currentFolder);
  const parentFolder = currentFolder.split("/").slice(0, -1).join("/");
  const canGoBack = currentFolder !== ROOT_FOLDER;

  const selectionIndex = (asset) => selectedAssets.findIndex((selected) => selected.objectKey === asset.objectKey);
  const toggleAsset = (asset) => {
    if (!asset?.catalogued) return;
    if (!multiple) {
      setSelectedAssets([asset]);
      return;
    }
    setSelectedAssets((current) => {
      const exists = current.some((selected) => selected.objectKey === asset.objectKey);
      return exists
        ? current.filter((selected) => selected.objectKey !== asset.objectKey)
        : [...current, asset];
    });
  };

  const useSelection = () => {
    if (!selectedAssets.length) return;
    onSelect(multiple ? selectedAssets : selectedAssets[0]);
    onClose();
  };

  return (
    <div className="portfolio-media-picker-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="portfolio-media-picker" role="dialog" aria-modal="true" aria-label="Choose from Media Library" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span className="editor-eyebrow">Cloudflare originals</span><h2>{multiple ? "Choose images from Media Library" : "Choose from Media Library"}</h2>{multiple && <p className="portfolio-media-picker-hint">Select as many images as you need. Selection order becomes display order.</p>}</div>
          <button type="button" className="quiet-button" onClick={onClose} aria-label="Close Media Library"><X size={18} /></button>
        </header>
        <div className="portfolio-media-picker-browserbar">
          <div className="portfolio-media-picker-navigation">
            <button type="button" className="quiet-button" disabled={!canGoBack || loading} onClick={() => setCurrentFolder(parentFolder)} aria-label="Go to parent folder"><ArrowLeft size={17} /></button>
            <nav aria-label="Current media folder">
              {breadcrumbs.map((crumb, index) => (
                <Fragment key={crumb.path}>
                  {index > 0 && <ChevronRight size={13} />}
                  <button type="button" onClick={() => setCurrentFolder(crumb.path)} disabled={crumb.path === currentFolder}>{crumb.name}</button>
                </Fragment>
              ))}
            </nav>
          </div>
          <label className="portfolio-media-picker-search">
            <Search size={16} />
            <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${currentFolder.replace(/^originals\/?/, "") || "originals"}`} />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
          </label>
        </div>
        {error && <div className="portfolio-media-picker-error">{error}</div>}
        <div className="portfolio-media-picker-grid">
          {loading ? (
            <div className="portfolio-media-picker-state"><LoaderCircle className="spin" size={22} /> Loading {currentFolder}…</div>
          ) : <>
            {visibleFolders.map((folder) => (
              <button type="button" className="is-folder" key={folder.path} onClick={() => { setQuery(""); setCurrentFolder(folder.path); }}>
                <span className="portfolio-media-picker-thumb portfolio-media-picker-folder"><FolderOpen size={34} /></span>
                <strong title={folder.name}>{folder.name}</strong>
                <small>Folder</small>
              </button>
            ))}
            {visibleAssets.map((asset) => {
              const preview = asset.variants?.["800"]?.url || asset.originalUrl;
              const selectedIndex = selectionIndex(asset);
              return (
                <button type="button" disabled={!asset.catalogued} className={selectedIndex >= 0 ? "is-selected" : ""} key={asset.objectKey} onClick={() => toggleAsset(asset)} onDoubleClick={() => { if (!multiple) { onSelect(asset); onClose(); } }} aria-pressed={selectedIndex >= 0}>
                  <span className="portfolio-media-picker-thumb">
                    <ImageIcon size={22} />
                    <img src={preview} alt="" loading="lazy" />
                    {selectedIndex >= 0 && <i>{multiple ? selectedIndex + 1 : <Check size={15} />}</i>}
                  </span>
                  <strong title={asset.originalFilename}>{asset.originalFilename}</strong>
                  <small title={asset.objectKey}>{asset.objectKey.replace(`${currentFolder}/`, "")}</small>
                  <em className={`media-state-${asset.processingStatus}`}>{asset.processingStatus === "ready" ? "Optimized" : asset.catalogued ? "Processing" : "Indexing"}</em>
                </button>
              );
            })}
            {!visibleFolders.length && !visibleAssets.length && <div className="portfolio-media-picker-state">This folder has no matching originals.</div>}
          </>}
        </div>
        <footer>
          <span>{multiple && selectedAssets.length ? `${selectedAssets.length} selected · ` : ""}{visibleFolders.length} {visibleFolders.length === 1 ? "folder" : "folders"} · {visibleAssets.length} {visibleAssets.length === 1 ? "image" : "images"}{truncated ? " · folder listing truncated" : ""}</span>
          <button type="button" className="primary-button" disabled={!selectedAssets.length} onClick={useSelection}>{multiple ? `Use ${selectedAssets.length || "selected"} image${selectedAssets.length === 1 ? "" : "s"}` : "Use selected image"}</button>
        </footer>
      </section>
    </div>
  );
}
