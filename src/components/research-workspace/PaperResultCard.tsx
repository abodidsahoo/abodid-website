import { ArrowUpRight, Download } from 'lucide-react';
import type { PaperResult } from './types';

type PaperResultCardProps = {
    paper: PaperResult;
};

export default function PaperResultCard({ paper }: PaperResultCardProps) {
    const actionIcon =
        paper.pdfUrl || paper.actionLabel.toLowerCase().includes('download')
            ? <Download size={16} />
            : <ArrowUpRight size={16} />;

    return (
        <article className="rw-paper-card">
            <div className="rw-paper-card__body">
                <div className="rw-paper-card__eyebrow">{paper.sourceLabel}</div>
                <h3>{paper.title}</h3>
                <p className="rw-paper-card__meta">
                    {paper.authors.length > 0 ? paper.authors.join(', ') : 'Authors unavailable'}
                    {' · '}
                    {paper.year ?? 'Year unknown'}
                </p>
                {paper.venue ? (
                    <p className="rw-paper-card__venue">{paper.venue}</p>
                ) : null}
                <p className="rw-paper-card__note">{paper.relevanceNote}</p>
                <div className="rw-paper-card__tags">
                    <span className="rw-chip">
                        {paper.isOpenAccess ? 'Open access' : 'Metadata match'}
                    </span>
                    {paper.doi ? (
                        <a
                            className="rw-chip rw-chip--link"
                            href={paper.doi}
                            target="_blank"
                            rel="noreferrer"
                        >
                            DOI
                        </a>
                    ) : null}
                </div>
            </div>

            <div className="rw-paper-card__actions">
                {paper.actionUrl ? (
                    <a
                        className="rw-button rw-button--secondary"
                        href={paper.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {actionIcon}
                        <span>{paper.actionLabel}</span>
                    </a>
                ) : (
                    <button
                        className="rw-button rw-button--secondary"
                        type="button"
                        disabled
                    >
                        <Download size={16} />
                        <span>Unavailable</span>
                    </button>
                )}
            </div>
        </article>
    );
}
