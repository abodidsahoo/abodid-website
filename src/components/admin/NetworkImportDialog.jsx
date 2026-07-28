import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";

const number = (value) => Number(value || 0).toLocaleString();

export default function NetworkImportDialog({
  open,
  accessToken,
  onClose,
  onImported,
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [report, setReport] = useState(null);
  const [errorCsv, setErrorCsv] = useState("");
  const [mappingPrompt, setMappingPrompt] = useState(null);
  const [mapping, setMapping] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setReport(null);
      setErrorCsv("");
      setMappingPrompt(null);
      setMapping({});
      setBusy("");
      setError("");
    }
  }, [open]);

  const upload = async (mode, nextFile = file, nextMapping = mapping) => {
    if (!nextFile) return;
    setBusy(mode);
    setError("");
    const formData = new FormData();
    formData.append("mode", mode);
    formData.append("file", nextFile);
    if (Object.keys(nextMapping || {}).length) {
      formData.append("mapping", JSON.stringify(nextMapping));
    }
    try {
      const response = await fetch("/api/admin/network/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 422 && payload.mappingRequired) {
        const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const suggested = Object.fromEntries(
          (payload.expectedColumns || []).map((expected) => {
            const expectedKey = normalize(expected);
            const match = (payload.detectedColumns || []).find((column) => {
              const columnKey = normalize(column);
              return columnKey === expectedKey
                || columnKey.includes(expectedKey)
                || expectedKey.includes(columnKey);
            });
            return [expected, match || ""];
          }),
        );
        setMappingPrompt(payload);
        setMapping(suggested);
        setPreview(null);
        setReport(null);
        return;
      }
      if (!response.ok) throw new Error(payload.error || `Import failed with ${response.status}.`);

      if (mode === "preview") {
        setPreview(payload.preview);
        setMappingPrompt(null);
        setReport(null);
      } else {
        setReport(payload.report);
        setErrorCsv(payload.errorCsv || "");
        onImported?.();
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  };

  const selectFile = (nextFile) => {
    if (!nextFile) return;
    setFile(nextFile);
    setPreview(null);
    setReport(null);
    setErrorCsv("");
    setMappingPrompt(null);
    setMapping({});
    upload("preview", nextFile, {});
  };

  const downloadErrors = () => {
    if (!errorCsv) return;
    const url = URL.createObjectURL(new Blob([errorCsv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `network-import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="ni-modal-layer" role="presentation">
      <button type="button" className="ni-modal-backdrop" aria-label="Close import" onClick={busy ? undefined : onClose} />
      <section className="ni-import-modal" role="dialog" aria-modal="true" aria-labelledby="ni-import-title">
        <header>
          <div>
            <span>Private source sync</span>
            <h3 id="ni-import-title">Import LinkedIn Connections.csv</h3>
            <p>Preview first. Existing notes, tags, accepted links and manual current values are preserved.</p>
          </div>
          <button type="button" aria-label="Close import" onClick={onClose} disabled={Boolean(busy)}><X size={18} /></button>
        </header>

        <div className="ni-import-body">
          {error && <div className="ni-alert ni-alert-error">{error}</div>}

          {!file && (
            <button
              type="button"
              className="ni-upload-dropzone"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                selectFile(event.dataTransfer.files?.[0]);
              }}
            >
              <Upload size={24} />
              <strong>Choose or drop Connections.csv</strong>
              <span>The raw file is sent only to the authenticated server import endpoint.</span>
            </button>
          )}

          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />

          {file && (
            <div className="ni-upload-file">
              <FileSpreadsheet size={20} />
              <div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div>
              {!busy && !report && <button type="button" onClick={() => inputRef.current?.click()}>Replace</button>}
            </div>
          )}

          {busy === "preview" && (
            <div className="ni-import-working"><LoaderCircle size={19} className="ni-spin" /> Profiling the CSV on the server…</div>
          )}

          {mappingPrompt && !preview && !report && busy !== "preview" && (
            <div className="ni-import-panel">
              <div className="ni-import-panel-heading">
                <div>
                  <strong>Map source columns</strong>
                  <span>The standard LinkedIn headers were not detected. Choose the matching source field for each required value.</span>
                </div>
                <span>{mappingPrompt.preambleRows} preamble lines ignored</span>
              </div>
              <div className="ni-mapping-grid">
                {mappingPrompt.expectedColumns.map((expected) => (
                  <label key={expected}>
                    <span>{expected}</span>
                    <select
                      value={mapping[expected] || ""}
                      onChange={(event) => setMapping((current) => ({
                        ...current,
                        [expected]: event.target.value,
                      }))}
                    >
                      <option value="">Choose a column</option>
                      {mappingPrompt.detectedColumns.map((column) => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="ni-button ni-button-primary"
                disabled={
                  Boolean(busy)
                  || mappingPrompt.expectedColumns.some((column) => !mapping[column])
                  || new Set(Object.values(mapping).filter(Boolean)).size
                    !== mappingPrompt.expectedColumns.length
                }
                onClick={() => upload("preview", file, mapping)}
              >
                Preview mapped file
              </button>
            </div>
          )}

          {preview && !report && (
            <>
              <div className="ni-import-stats">
                <div><span>Total rows</span><strong>{number(preview.totalRows)}</strong></div>
                <div><span>Ready to upsert</span><strong>{number(preview.validRows)}</strong></div>
                <div><span>Duplicates</span><strong>{number(preview.duplicateCount)}</strong></div>
                <div><span>Invalid rows</span><strong>{number(preview.failedRows)}</strong></div>
              </div>

              <div className="ni-import-panel">
                <div className="ni-import-panel-heading">
                  <strong>Detected mapping</strong>
                  <span>{preview.preambleRows} LinkedIn preamble lines ignored</span>
                </div>
                <div className="ni-detected-columns">
                  {preview.detectedColumns.map((column) => <span key={column}><Check size={11} /> {column}</span>)}
                </div>
              </div>

              <div className="ni-import-panel">
                <div className="ni-import-panel-heading">
                  <strong>Blank-field check</strong>
                  <span>Ground-truth availability</span>
                </div>
                <dl className="ni-blank-counts">
                  {Object.entries(preview.blankCounts).map(([column, count]) => (
                    <div key={column}><dt>{column}</dt><dd>{number(count)} blank</dd></div>
                  ))}
                </dl>
              </div>

              {preview.errorPreview?.length > 0 && (
                <div className="ni-import-warning">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{number(preview.failedRows + preview.duplicateCount)} rows will not be invented or merged</strong>
                    <p>
                      The preview found identity-empty or invalid source rows. They will appear in the downloadable error report; valid contacts still import.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {busy === "commit" && (
            <div className="ni-import-working">
              <LoaderCircle size={19} className="ni-spin" />
              <div>
                <strong>Safely syncing {number(preview?.validRows)} contacts…</strong>
                <span>New rows are inserted; source changes are updated without replacing manual context.</span>
              </div>
            </div>
          )}

          {report && (
            <div className="ni-import-complete">
              <div className="ni-import-success">
                <span><Check size={18} /></span>
                <div><strong>Private sync complete</strong><p>No contact was deleted because it was absent from this export.</p></div>
              </div>
              <div className="ni-import-stats ni-import-report">
                <div><span>Inserted</span><strong>{number(report.inserted)}</strong></div>
                <div><span>Updated</span><strong>{number(report.updated)}</strong></div>
                <div><span>Unchanged</span><strong>{number(report.unchanged)}</strong></div>
                <div><span>Failed</span><strong>{number(report.failed)}</strong></div>
              </div>
              {report.pendingEmbeddings > 0 && (
                <p className="ni-index-note">
                  {number(report.pendingEmbeddings)} new or changed contacts are queued for semantic indexing. Use the explicit Index action after closing this report.
                </p>
              )}
              {errorCsv && (
                <button type="button" className="ni-button ni-button-quiet" onClick={downloadErrors}>
                  <Download size={14} />
                  Download error report
                </button>
              )}
            </div>
          )}
        </div>

        <footer>
          <span>LinkedIn URL is the primary match key. Newsletter consent is never inferred.</span>
          <div>
            <button type="button" className="ni-button ni-button-quiet" onClick={onClose} disabled={Boolean(busy)}>
              {report ? "Close" : "Cancel"}
            </button>
            {preview && !report && (
              <button type="button" className="ni-button ni-button-primary" onClick={() => upload("commit")} disabled={Boolean(busy)}>
                {busy ? <LoaderCircle size={14} className="ni-spin" /> : <Upload size={14} />}
                Sync {number(preview.validRows)} contacts
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
