import { Download, FileStack, Sparkles } from 'lucide-react';
import type { UploadedPaper } from './types';

type PaperBatchListProps = {
    papers: UploadedPaper[];
    selectedPaperId: string | null;
    processingInsightPaperId: string | null;
    onSelectPaper: (paperId: string) => void;
    onDownloadAll: () => void;
};

export default function PaperBatchList({
    papers,
    selectedPaperId,
    processingInsightPaperId,
    onSelectPaper,
    onDownloadAll
}: PaperBatchListProps) {
    if (papers.length === 0) {
        return null;
    }

    return (
        <section className="rw-section">
            <div className="rw-section-heading rw-section-heading--spread">
                <div>
                    <p className="rw-section-heading__eyebrow">Renamed Papers</p>
                    <h2>Your paper batch</h2>
                </div>
                <button
                    className="rw-button rw-button--secondary"
                    type="button"
                    onClick={onDownloadAll}
                >
                    <Download size={16} />
                    <span>Download All</span>
                </button>
            </div>

            <div className="rw-paper-batch-list">
                {papers.map((paper) => {
                    const isSelected = paper.id === selectedPaperId;
                    const isInsightProcessing = paper.id === processingInsightPaperId;
                    const cleanDownloadUrl = `${paper.downloadUrls.clean}&filename=${encodeURIComponent(
                        paper.preferredFileName || paper.cleanFileName
                    )}`;

                    return (
                        <article
                            key={paper.id}
                            className={`rw-paper-queue-card${isSelected ? ' rw-paper-queue-card--active' : ''}`}
                        >
                            <button
                                className="rw-paper-queue-card__select"
                                type="button"
                                onClick={() => onSelectPaper(paper.id)}
                            >
                                <div className="rw-paper-queue-card__copy">
                                    <div className="rw-paper-queue-card__eyebrow">
                                        <FileStack size={14} />
                                        <span>
                                            {paper.insights
                                                ? 'Insights ready'
                                                : isInsightProcessing
                                                    ? 'Generating insights'
                                                    : 'Rename ready'}
                                        </span>
                                    </div>
                                    <h3>{paper.displayTitle}</h3>
                                    <p className="rw-paper-queue-card__meta">
                                        Original: {paper.originalFileName}
                                    </p>
                                    <p className="rw-paper-queue-card__meta">
                                        Clean: {paper.preferredFileName || paper.cleanFileName}
                                    </p>
                                </div>
                            </button>

                            <div className="rw-paper-queue-card__actions">
                                <a
                                    className="rw-chip rw-chip--link"
                                    href={cleanDownloadUrl}
                                >
                                    Download clean
                                </a>
                                <a
                                    className="rw-chip rw-chip--link"
                                    href={paper.downloadUrls.original}
                                >
                                    Download original
                                </a>
                                <button
                                    className="rw-chip"
                                    type="button"
                                    onClick={() => onSelectPaper(paper.id)}
                                >
                                    {paper.insights ? (
                                        <>
                                            <Sparkles size={14} />
                                            <span>View insights</span>
                                        </>
                                    ) : (
                                        <span>Open</span>
                                    )}
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
