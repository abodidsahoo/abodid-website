import {
    startTransition,
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
    type KeyboardEvent
} from 'react';
import {
    AlertCircle,
    ChevronDown,
    CheckCircle2,
    FileText,
    LoaderCircle,
    UploadCloud
} from 'lucide-react';
import { slugify } from '../../lib/research-workspace/name-utils';
import type {
    CuratedPdfMetadataPreview,
    UploadPaperResponse,
    UploadedPaper
} from './types';

type UploadItemState = 'uploading' | 'ready' | 'error';

type UploadItem = {
    id: string;
    originalFileName: string;
    state: UploadItemState;
    paper: UploadedPaper | null;
    errorMessage: string | null;
};

export default function MinimalRenamerPage() {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [items, setItems] = useState<UploadItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const openPicker = () => {
        if (isUploading) {
            return;
        }

        inputRef.current?.click();
    };

    const updateItem = (itemId: string, updates: Partial<UploadItem>) => {
        setItems((currentItems) =>
            currentItems.map((item) =>
                item.id === itemId
                    ? {
                        ...item,
                        ...updates
                    }
                    : item
            )
        );
    };

    const processFiles = async (files: File[]) => {
        if (files.length === 0 || isUploading) {
            return;
        }

        const pdfFiles = files.filter((file) => {
            return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        });

        if (pdfFiles.length === 0) {
            setErrorMessage('Only PDF files are supported here.');
            return;
        }

        setErrorMessage(null);
        setIsUploading(true);

        const queuedItems = pdfFiles.map((file) => ({
            id: createUploadId(),
            originalFileName: file.name,
            state: 'uploading' as const,
            paper: null,
            errorMessage: null
        }));

        startTransition(() => {
            setItems((currentItems) => [...queuedItems, ...currentItems]);
        });

        for (let index = 0; index < pdfFiles.length; index += 1) {
            const file = pdfFiles[index];
            const queuedItem = queuedItems[index];

            try {
                const formData = new FormData();
                formData.append('sourceType', 'file');
                formData.append('file', file);

                const response = await fetch('/api/paper-renamer/papers', {
                    method: 'POST',
                    body: formData
                });

                const data = (await response.json()) as UploadPaperResponse & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(data.error || 'Upload failed.');
                }

                updateItem(queuedItem.id, {
                    state: 'ready',
                    paper: data.paper,
                    errorMessage: null
                });
            } catch (error) {
                updateItem(queuedItem.id, {
                    state: 'error',
                    paper: null,
                    errorMessage:
                        error instanceof Error
                            ? error.message
                            : 'This PDF could not be processed.'
                });
            }
        }

        setIsUploading(false);
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        await processFiles(files);
        event.target.value = '';
    };

    const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);

        if (isUploading) {
            return;
        }

        await processFiles(Array.from(event.dataTransfer.files ?? []));
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
        }
    };

    return (
        <section className="rw-page">
            <div className="rw-stage rw-stage--minimal">
                <div className="rw-mini-shell">
                    <header className="rw-mini-hero">
                        <div className="rw-eyebrow">
                            <UploadCloud size={14} />
                            <span>Paper Renamer</span>
                        </div>
                        <h1>Paper Renamer</h1>
                        <p>
                            Upload a research paper PDF and this tool reads its details,
                            gives it a clean filename, and prepares a renamed download.
                            You can also open a short insight view and review the added metadata.
                        </p>
                    </header>

                    <section className="rw-workspace-card rw-mini-card">
                        <div
                            className={`rw-mini-dropzone${isDragging ? ' rw-mini-dropzone--active' : ''}${isUploading ? ' rw-mini-dropzone--busy' : ''}`}
                            onClick={openPicker}
                            onDragOver={(event) => {
                                event.preventDefault();
                                if (!isUploading) {
                                    setIsDragging(true);
                                }
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onKeyDown={handleKeyDown}
                            role="button"
                            tabIndex={isUploading ? -1 : 0}
                            aria-busy={isUploading}
                            aria-label="Upload PDF files"
                        >
                            <div className="rw-mini-dropzone__icon" aria-hidden="true">
                                {isUploading ? (
                                    <LoaderCircle size={22} className="rw-spin" />
                                ) : (
                                    <FileText size={22} />
                                )}
                            </div>
                            <h2>{isUploading ? 'Uploading PDFs...' : 'Drop PDFs here'}</h2>
                            <p>
                                {isUploading
                                    ? 'Files upload automatically as soon as you choose them.'
                                    : 'Or click to choose files from your device.'}
                            </p>
                        </div>

                        <input
                            ref={inputRef}
                            className="rw-hidden-input"
                            type="file"
                            accept="application/pdf"
                            multiple
                            disabled={isUploading}
                            onChange={handleFileChange}
                        />

                        {errorMessage ? (
                            <div className="rw-mini-banner rw-mini-banner--error" role="alert">
                                <AlertCircle size={16} />
                                <span>{errorMessage}</span>
                            </div>
                        ) : null}

                        {items.length > 0 ? (
                            <div className="rw-mini-results">
                                {items.map((item) => (
                                    <UploadResultCard key={item.id} item={item} />
                                ))}
                            </div>
                        ) : null}
                    </section>
                </div>
            </div>
        </section>
    );
}

function UploadResultCard({ item }: { item: UploadItem }) {
    if (item.state === 'uploading') {
        return (
            <article className="rw-mini-result-card">
                <div className="rw-mini-result-card__copy">
                    <div className="rw-mini-result-card__status rw-mini-result-card__status--uploading">
                        <LoaderCircle size={15} className="rw-spin" />
                        <span>Uploading</span>
                    </div>
                    <div className="rw-mini-result-card__mapping">
                        <div className="rw-mini-result-card__field">
                            <span className="rw-mini-result-card__label">Original file</span>
                            <p className="rw-mini-result-card__file-name">
                                {item.originalFileName}
                            </p>
                        </div>
                    </div>
                    <p>Renaming this PDF now.</p>
                </div>
            </article>
        );
    }

    if (item.state === 'error') {
        return (
            <article className="rw-mini-result-card">
                <div className="rw-mini-result-card__copy">
                    <div className="rw-mini-result-card__status rw-mini-result-card__status--error">
                        <AlertCircle size={15} />
                        <span>Could not process</span>
                    </div>
                    <div className="rw-mini-result-card__mapping">
                        <div className="rw-mini-result-card__field">
                            <span className="rw-mini-result-card__label">Original file</span>
                            <p className="rw-mini-result-card__file-name">
                                {item.originalFileName}
                            </p>
                        </div>
                    </div>
                    <p>{item.errorMessage || 'This PDF could not be processed.'}</p>
                </div>
            </article>
        );
    }

    const paper = item.paper;

    if (!paper) {
        return null;
    }

    const renamedFile = paper.preferredFileName || paper.cleanFileName;
    const downloadUrl = `${paper.downloadUrls.clean}&filename=${encodeURIComponent(renamedFile)}`;
    const insightsUrl = `/paper-renamer/insights/${paper.id}/${slugify(
        renamedFile.replace(/\.pdf$/i, '')
    ) || 'paper-insights'}`;

    return (
        <article className="rw-mini-result-card rw-mini-result-card--ready">
            <div className="rw-mini-result-card__copy">
                <div className="rw-mini-result-card__status rw-mini-result-card__status--ready">
                    <CheckCircle2 size={15} />
                    <span>Ready to download</span>
                </div>
                <div className="rw-mini-result-card__mapping">
                    <div className="rw-mini-result-card__field">
                        <span className="rw-mini-result-card__label">Original file</span>
                        <p className="rw-mini-result-card__file-name">
                            {item.originalFileName}
                        </p>
                    </div>
                    <div className="rw-mini-result-card__field">
                        <span className="rw-mini-result-card__label">Paper title</span>
                        <p className="rw-mini-result-card__paper-title">
                            {paper.displayTitle}
                        </p>
                    </div>
                    <div className="rw-mini-result-card__field">
                        <span className="rw-mini-result-card__label">Renamed file</span>
                        <p className="rw-mini-result-card__file-name">
                            {renamedFile}
                        </p>
                        {paper.curation ? (
                            <MetadataPreviewDropdown metadata={paper.curation} />
                        ) : null}
                        <div className="rw-mini-result-card__actions">
                            <a className="rw-button rw-button--primary" href={downloadUrl}>
                                Download Renamed File
                            </a>
                            <a className="rw-button rw-button--secondary" href={insightsUrl}>
                                Read Paper Insights
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

function MetadataPreviewDropdown({
    metadata
}: {
    metadata: CuratedPdfMetadataPreview;
}) {
    const fields = [
        { label: 'Publisher', value: metadata.publisher },
        { label: 'Authors', value: metadata.authorsLine },
        { label: 'DOI', value: metadata.doi },
        { label: 'Abstract', value: metadata.abstract },
        { label: 'Rights', value: metadata.rightsMessage }
    ].filter((field) => field.value && field.value.trim().length > 0);

    return (
        <details className="rw-mini-metadata">
            <summary className="rw-mini-metadata__summary">
                <span>Show Added Metadata</span>
                <ChevronDown size={12} />
            </summary>
            <div className="rw-mini-metadata__panel">
                {fields.map((field) => (
                    <div key={field.label} className="rw-mini-metadata__row">
                        <span className="rw-mini-metadata__label">{field.label}</span>
                        <p className="rw-mini-metadata__value">{field.value}</p>
                    </div>
                ))}
            </div>
        </details>
    );
}

function createUploadId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `upload-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}
