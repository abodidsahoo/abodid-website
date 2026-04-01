import { Download, FileText, Sparkles } from 'lucide-react';
import EmptyState from './EmptyState';
import type { UploadedPaper } from './types';

type RenamerFocusPanelProps = {
    paper: UploadedPaper | null;
    cleanDownloadUrl: string | null;
    originalDownloadUrl: string | null;
    insightsHref: string;
};

export default function RenamerFocusPanel({
    paper,
    cleanDownloadUrl,
    originalDownloadUrl,
    insightsHref
}: RenamerFocusPanelProps) {
    if (!paper) {
        return (
            <EmptyState
                icon={<FileText size={20} />}
                title="Upload one or more papers to start renaming"
                description="The renamer path keeps the interface focused on clean filenames, batch handling, and quick downloads."
            />
        );
    }

    const metaLine = [
        paper.authors.length > 0 ? paper.authors.join(', ') : null,
        paper.year ? String(paper.year) : null,
        paper.journal
    ].filter(Boolean).join(' · ');

    return (
        <article className="rw-summary-surface">
            <header className="rw-summary-header">
                <div className="rw-summary-header__copy">
                    <div className="rw-inline-badge">
                        <FileText size={14} />
                        <span>Selected renamed paper</span>
                    </div>
                    <h2>{paper.displayTitle}</h2>
                    {metaLine ? (
                        <p className="rw-summary-header__meta">{metaLine}</p>
                    ) : null}
                    <p className="rw-summary-header__abstract">
                        Clean filename: {paper.preferredFileName || paper.cleanFileName}
                    </p>
                </div>

                <div className="rw-summary-actions">
                    <a className="rw-button rw-button--primary" href={cleanDownloadUrl || '#'}>
                        <Download size={16} />
                        <span>Download Clean PDF</span>
                    </a>
                    <a className="rw-button rw-button--secondary" href={originalDownloadUrl || '#'}>
                        <Download size={16} />
                        <span>Download Original PDF</span>
                    </a>
                    <a
                        className="rw-button rw-button--ghost"
                        href={insightsHref}
                    >
                        <Sparkles size={16} />
                        <span>Open In Insights</span>
                    </a>
                </div>
            </header>

            <div className="rw-summary-grid">
                <section className="rw-summary-card">
                    <div className="rw-summary-card__header">
                        <p className="rw-section-heading__eyebrow">What this does</p>
                    </div>
                    <p className="rw-summary-card__summary">
                        This paper is already stored with a structured clean name and is ready to download.
                    </p>
                    <p className="rw-summary-card__detail">
                        Keep working through your batch here, or switch this paper into the insights flow when you want a readable summary.
                    </p>
                </section>
            </div>
        </article>
    );
}
