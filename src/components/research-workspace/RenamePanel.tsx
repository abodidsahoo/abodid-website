import { FilePenLine } from 'lucide-react';
import EmptyState from './EmptyState';
import FilenamePreview from './FilenamePreview';
import type { UploadedPaper } from './types';

type RenameMode = 'idle' | 'clean' | 'original' | 'custom';

type RenamePanelProps = {
    paper: UploadedPaper | null;
    fileName: string;
    nameMode: RenameMode;
    statusMessage?: string | null;
    cleanDownloadUrl?: string | null;
    originalDownloadUrl?: string | null;
    onFileNameChange: (value: string) => void;
    onFileNameBlur?: () => void;
    onApplyCleanName: () => void;
    onUseOriginalName: () => void;
};

const renameModeCopy: Record<RenameMode, string> = {
    idle: 'Choose how the file should be saved when rename actions go live.',
    clean: 'Clean filename selected and ready for a future rename API.',
    original: 'Original filename selected as the current save preference.',
    custom: 'Custom filename draft ready for future apply actions.'
};

export default function RenamePanel({
    paper,
    fileName,
    nameMode,
    statusMessage,
    cleanDownloadUrl,
    originalDownloadUrl,
    onFileNameChange,
    onFileNameBlur,
    onApplyCleanName,
    onUseOriginalName
}: RenamePanelProps) {
    if (!paper) {
        return (
            <section className="rw-section">
                <div className="rw-section-heading">
                    <div>
                        <p className="rw-section-heading__eyebrow">Rename</p>
                        <h2>Prepare a clean paper filename</h2>
                    </div>
                </div>

                <EmptyState
                    icon={<FilePenLine size={20} />}
                    title="Upload a paper to rename it and extract insights"
                    description="Once a file or link is prepared, the detected title and clean filename draft will appear here."
                    compact
                />
            </section>
        );
    }

    return (
        <section className="rw-section">
            <div className="rw-section-heading">
                <div>
                    <p className="rw-section-heading__eyebrow">Rename</p>
                    <h2>Clean up the filename before you save it</h2>
                </div>
            </div>

            <dl className="rw-definition-grid">
                <div>
                    <dt>Detected paper title</dt>
                    <dd>{paper.displayTitle}</dd>
                </div>
                <div>
                    <dt>Source snapshot</dt>
                    <dd>{paper.sourceLabel}</dd>
                </div>
                <div>
                    <dt>Author + year</dt>
                    <dd>
                        {paper.authors.length > 0
                            ? `${paper.authors[0]}${paper.year ? ` · ${paper.year}` : ''}`
                            : paper.year
                                ? String(paper.year)
                                : 'Not clearly found'}
                    </dd>
                </div>
                <div>
                    <dt>Journal / source</dt>
                    <dd>{paper.journal || 'Not clearly found'}</dd>
                </div>
            </dl>

            <FilenamePreview
                value={fileName}
                onChange={onFileNameChange}
                onBlur={onFileNameBlur}
            />

            <div className="rw-button-row">
                <button
                    className="rw-button rw-button--primary"
                    type="button"
                    onClick={onApplyCleanName}
                >
                    Apply Clean Name
                </button>
                <button
                    className="rw-button rw-button--ghost"
                    type="button"
                    onClick={onUseOriginalName}
                >
                    Use Original Name
                </button>
            </div>

            <div className="rw-button-row">
                <a
                    className="rw-button rw-button--secondary"
                    href={cleanDownloadUrl || '#'}
                    aria-disabled={!cleanDownloadUrl}
                >
                    Download Clean PDF
                </a>
                <a
                    className="rw-button rw-button--ghost"
                    href={originalDownloadUrl || '#'}
                    aria-disabled={!originalDownloadUrl}
                >
                    Download Original PDF
                </a>
            </div>

            <p className="rw-status-note">{statusMessage || renameModeCopy[nameMode]}</p>

            {paper.warnings.length > 0 ? (
                <div className="rw-warning-list">
                    {paper.warnings.slice(0, 3).map((warning, index) => (
                        <p key={`${warning}-${index}`}>{warning}</p>
                    ))}
                </div>
            ) : null}
        </section>
    );
}
