import { Download, FileText, Printer, Quote } from 'lucide-react';
import type { PaperInsightSummary, UploadedPaper } from './types';

type InsightSummaryViewProps = {
    paper: UploadedPaper;
    insights: PaperInsightSummary;
    cleanDownloadUrl: string;
    originalDownloadUrl: string;
    onPrint: () => void;
};

export default function InsightSummaryView({
    paper,
    insights,
    cleanDownloadUrl,
    originalDownloadUrl,
    onPrint
}: InsightSummaryViewProps) {
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
                        <span>Structured paper insights</span>
                    </div>
                    <h2>{paper.displayTitle}</h2>
                    {metaLine ? (
                        <p className="rw-summary-header__meta">{metaLine}</p>
                    ) : null}
                    {paper.abstract ? (
                        <p className="rw-summary-header__abstract">{paper.abstract}</p>
                    ) : null}
                </div>

                <div className="rw-summary-actions">
                    <a className="rw-button rw-button--primary" href={cleanDownloadUrl}>
                        <Download size={16} />
                        <span>Download Clean PDF</span>
                    </a>
                    <a className="rw-button rw-button--secondary" href={originalDownloadUrl}>
                        <Download size={16} />
                        <span>Download Original PDF</span>
                    </a>
                    <button
                        className="rw-button rw-button--ghost"
                        type="button"
                        onClick={onPrint}
                    >
                        <Printer size={16} />
                        <span>Print Summary</span>
                    </button>
                </div>
            </header>

            {insights.extractionNotes.length > 0 ? (
                <div className="rw-summary-notes">
                    {insights.extractionNotes.map((note, index) => (
                        <p key={`${note}-${index}`}>{note}</p>
                    ))}
                </div>
            ) : null}

            <div className="rw-summary-grid">
                {insights.sections.map((section) => (
                    <section key={section.id} className="rw-summary-card">
                        <div className="rw-summary-card__header">
                            <p className="rw-section-heading__eyebrow">{section.heading}</p>
                            {section.provenance.length > 0 ? (
                                <span className="rw-summary-card__pages">
                                    p. {section.provenance.map((item) => item.pageNumber).join(', ')}
                                </span>
                            ) : null}
                        </div>
                        <p className="rw-summary-card__summary">{section.summary}</p>
                        {section.detail ? (
                            <p className="rw-summary-card__detail">{section.detail}</p>
                        ) : null}

                        {section.quotes && section.quotes.length > 0 ? (
                            <div className="rw-quote-stack">
                                {section.quotes.map((quote) => (
                                    <blockquote key={quote.id} className="rw-quote-card">
                                        <div className="rw-quote-card__eyebrow">
                                            <Quote size={14} />
                                            <span>
                                                Page {quote.provenance.pageNumber}
                                            </span>
                                        </div>
                                        <p>{quote.text}</p>
                                        <footer>{quote.note}</footer>
                                    </blockquote>
                                ))}
                            </div>
                        ) : null}
                    </section>
                ))}
            </div>
        </article>
    );
}
